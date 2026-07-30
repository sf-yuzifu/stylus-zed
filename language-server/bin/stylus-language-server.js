#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createConnection,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { validateStylus } from "../src/diagnostics.js";
import { getColorPresentations, getDocumentColors } from "../src/colors.js";
import { getCompletions } from "../src/completion.js";
import { evaluateExpressions } from "../src/evaluate.js";
import { DEFAULT_FORMAT_CONFIG, formatDocument, formatDocumentRange } from "../src/format.js";
import { getHover } from "../src/hover.js";
import {
  getDefinition,
  getPrepareRename,
  targetAt,
} from "../src/navigation.js";
import { getSignatureHelp } from "../src/signature.js";
import { collectWorkspaceIndex } from "../src/workspace.js";
import { listStylusFiles, reverseReachable } from "../src/workspaceFiles.js";
import {
  getDocumentSymbols,
  getWorkspaceReferences,
  getWorkspaceRenameEdits,
} from "../src/workspaceRefs.js";

const CHANGE_DEBOUNCE_MS = 200;
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const timers = new Map();
const resultsByDocument = new Map();
const symbolCache = new Map();
const fileIndexCache = new Map();
const fileListCache = new Map();
const evalCache = new Map();
let workspaceFolders = [];
let formatConfig = DEFAULT_FORMAT_CONFIG;
let tabStopCharExplicit = false;

const FILE_LIST_TTL_MS = 5000;
const FILE_INDEX_CACHE_MAX = 100;

connection.onInitialize((params) => {
  const requested = params.initializationOptions?.format;
  if (requested && typeof requested === "object") {
    tabStopCharExplicit = "tabStopChar" in requested;
    formatConfig = {
      ...DEFAULT_FORMAT_CONFIG,
      ...requested,
      options: requested.options ?? {},
    };
  }

  if (Array.isArray(params.workspaceFolders) && params.workspaceFolders.length > 0) {
    workspaceFolders = params.workspaceFolders.map((folder) => folder.uri);
  } else if (params.rootUri) {
    workspaceFolders = [params.rootUri];
  }

  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
        save: { includeText: false },
      },
      completionProvider: {
        triggerCharacters: ["$", "@", ":", "-", "(", " ", "."],
        resolveProvider: false,
      },
      hoverProvider: true,
      colorProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ["(", ","],
        retriggerCharacters: [","],
      },
      definitionProvider: true,
      referencesProvider: true,
      renameProvider: { prepareProvider: true },
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      documentSymbolProvider: true,
    },
    serverInfo: {
      name: "stylus-language-server",
      version: "0.8.0",
    },
  };
});

function symbolsFor(document) {
  const cached = symbolCache.get(document.uri);
  if (
    cached &&
    cached.version === document.version &&
    cached.files.every((file) => file.mtime === mtimeOf(file.uri))
  ) {
    return cached.index;
  }
  const { index, files } = collectWorkspaceIndex(document.uri, document.getText());
  symbolCache.set(document.uri, { version: document.version, files, index });
  return index;
}

function mtimeOf(uri) {
  try {
    return statSync(fileURLToPath(uri)).mtimeMs;
  } catch {
    return 0;
  }
}

function resolveText(uri) {
  const open = documents.get(uri);
  if (open) return open.getText();
  try {
    return readFileSync(fileURLToPath(uri), "utf8");
  } catch {
    return null;
  }
}

function listCandidateUris(currentUri) {
  const roots =
    workspaceFolders.length > 0
      ? workspaceFolders
      : [pathToFileURL(path.dirname(fileURLToPath(currentUri))).href];

  const uris = new Set([currentUri]);
  for (const root of roots) {
    const cached = fileListCache.get(root);
    if (cached && Date.now() - cached.time < FILE_LIST_TTL_MS) {
      for (const file of cached.files) uris.add(file);
      continue;
    }
    const files = listStylusFiles(root);
    fileListCache.set(root, { time: Date.now(), files });
    for (const file of files) uris.add(file);
  }
  return [...uris];
}

function indexForFile(uri) {
  const text = resolveText(uri);
  if (text == null) return null;

  const openVersion = documents.get(uri)?.version ?? null;
  const cached = fileIndexCache.get(uri);
  if (
    cached &&
    cached.openVersion === openVersion &&
    cached.files.every((file) => file.mtime === mtimeOf(file.uri))
  ) {
    return cached;
  }

  const entry = collectWorkspaceIndex(uri, text);
  entry.openVersion = openVersion;
  if (fileIndexCache.size >= FILE_INDEX_CACHE_MAX) fileIndexCache.clear();
  fileIndexCache.set(uri, entry);
  return entry;
}

connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  return {
    isIncomplete: false,
    items: getCompletions(
      document.getText(),
      params.position,
      symbolsFor(document),
    ),
  };
});

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  return getHover(document.getText(), params.position, symbolsFor(document));
});

connection.onDocumentColor((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  const index = symbolsFor(document);
  return getDocumentColors(document.getText(), index, document.uri, (_uri, idx, candidates) =>
    cachedEvaluate(document, idx, candidates),
  );
});

function filesKeyFor(uri) {
  const cached = symbolCache.get(uri);
  return cached ? cached.files.map((file) => file.mtime).join(":") : "";
}

function cachedEvaluate(document, index, candidates) {
  const key = `${document.version}::${filesKeyFor(document.uri)}`;
  const cached = evalCache.get(document.uri);
  if (cached && cached.key === key) return cached.results;

  const results = evaluateExpressions(document.uri, index, candidates);
  if (evalCache.size > 50) evalCache.clear();
  evalCache.set(document.uri, { key, results });
  return results;
}

function textInRange(text, range) {
  if (range.start.line !== range.end.line) return "";
  const line = text.split(/\r?\n/)[range.start.line] ?? "";
  return line.slice(range.start.character, range.end.character);
}

connection.onColorPresentation((params) => {
  const document = documents.get(params.textDocument.uri);
  const spanned = document ? textInRange(document.getText(), params.range) : undefined;
  return getColorPresentations(params.color, params.range, spanned);
});

connection.onSignatureHelp((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  return getSignatureHelp(document.getText(), params.position, symbolsFor(document));
});

connection.onDefinition((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  return getDefinition(
    document.getText(),
    params.position,
    symbolsFor(document),
    document.uri,
    resolveText,
  );
});

connection.onReferences((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  const index = symbolsFor(document);
  const text = document.getText();

  const target = getWorkspaceReferences({
    text,
    position: params.position,
    index,
    uri: document.uri,
    includeDeclaration: params.context.includeDeclaration,
    resolveText,
    listCandidateUris: () => {
      const candidates = listCandidateUris(document.uri);
      const token = targetAt(text, params.position, index);
      const targetUri = token?.resolved.symbol.uri ?? document.uri;
      return token
        ? [...reverseReachable(targetUri, candidates, resolveText)]
        : [document.uri];
    },
    indexForFile,
  }).map(({ uri, range }) => ({ uri, range }));

  return target;
});

connection.onPrepareRename((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  return getPrepareRename(document.getText(), params.position, symbolsFor(document));
});

connection.onRenameRequest((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  const index = symbolsFor(document);
  const text = document.getText();

  return getWorkspaceRenameEdits({
    text,
    position: params.position,
    index,
    uri: document.uri,
    newName: params.newName,
    resolveText,
    listCandidateUris: () => {
      const candidates = listCandidateUris(document.uri);
      const token = targetAt(text, params.position, index);
      const targetUri = token?.resolved.symbol.uri ?? document.uri;
      return token
        ? [...reverseReachable(targetUri, candidates, resolveText)]
        : [document.uri];
    },
    indexForFile,
  });
});

connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  return getDocumentSymbols(document.getText(), symbolsFor(document));
});

function configForRequest(params) {
  if (tabStopCharExplicit || !params.options) return formatConfig;
  const unit =
    params.options.insertSpaces === false
      ? "\t"
      : " ".repeat(params.options.tabSize || 2);
  return { ...formatConfig, tabStopChar: unit };
}

connection.onDocumentFormatting((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const result = formatDocument(document.getText(), configForRequest(params), {
    uri: document.uri,
  });
  if (result.refused) {
    connection.console.log(`Formatting skipped for ${document.uri}: ${result.refused}`);
    return null;
  }
  return result.edits;
});

connection.onDocumentRangeFormatting((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const result = formatDocumentRange(document.getText(), params.range, configForRequest(params), {
    uri: document.uri,
  });
  if (result.refused) {
    connection.console.log(`Range formatting skipped for ${document.uri}: ${result.refused}`);
    return null;
  }
  return result.edits;
});

function clearTimer(uri) {
  const timer = timers.get(uri);
  if (timer) {
    clearTimeout(timer);
    timers.delete(uri);
  }
}

function publishTarget(uri) {
  const diagnostics = [];
  const seen = new Set();

  for (const result of resultsByDocument.values()) {
    if (result.uri !== uri) continue;

    for (const diagnostic of result.diagnostics) {
      const key = JSON.stringify(diagnostic);
      if (seen.has(key)) continue;
      seen.add(key);
      diagnostics.push(diagnostic);
    }
  }

  connection.sendDiagnostics({ uri, diagnostics });
}

function publish(document) {
  clearTimer(document.uri);

  const previousTarget = resultsByDocument.get(document.uri)?.uri;
  const result = validateStylus(document.uri, document.getText());
  resultsByDocument.set(document.uri, result);

  if (previousTarget && previousTarget !== result.uri) publishTarget(previousTarget);
  publishTarget(result.uri);
}

function schedule(document) {
  clearTimer(document.uri);
  timers.set(
    document.uri,
    setTimeout(() => publish(document), CHANGE_DEBOUNCE_MS),
  );
}

documents.onDidOpen(({ document }) => publish(document));
documents.onDidChangeContent(({ document }) => schedule(document));
documents.onDidSave(({ document }) => publish(document));
documents.onDidClose(({ document }) => {
  clearTimer(document.uri);
  const target = resultsByDocument.get(document.uri)?.uri ?? document.uri;
  resultsByDocument.delete(document.uri);
  symbolCache.delete(document.uri);
  publishTarget(target);
});

documents.listen(connection);
connection.listen();
