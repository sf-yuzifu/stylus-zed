#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
import { DEFAULT_FORMAT_CONFIG, formatDocument } from "../src/format.js";
import { getHover } from "../src/hover.js";
import {
  getDefinition,
  getPrepareRename,
  getReferences,
  getRenameEdits,
} from "../src/navigation.js";
import { getSignatureHelp } from "../src/signature.js";
import { collectWorkspaceIndex } from "../src/workspace.js";

const CHANGE_DEBOUNCE_MS = 200;
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const timers = new Map();
const resultsByDocument = new Map();
const symbolCache = new Map();
let formatConfig = DEFAULT_FORMAT_CONFIG;

connection.onInitialize((params) => {
  const requested = params.initializationOptions?.format;
  if (requested && typeof requested === "object") {
    formatConfig = {
      ...DEFAULT_FORMAT_CONFIG,
      ...requested,
      options: requested.options ?? {},
    };
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
    },
    serverInfo: {
      name: "stylus-language-server",
      version: "0.7.0",
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
  return getDocumentColors(document.getText(), symbolsFor(document));
});

connection.onColorPresentation((params) => {
  return getColorPresentations(params.color, params.range);
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
  return getReferences(
    document.getText(),
    params.position,
    symbolsFor(document),
    document.uri,
    params.context.includeDeclaration,
    resolveText,
  ).map(({ uri, range }) => ({ uri, range }));
});

connection.onPrepareRename((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  return getPrepareRename(document.getText(), params.position, symbolsFor(document));
});

connection.onRenameRequest((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  return getRenameEdits(
    document.getText(),
    params.position,
    symbolsFor(document),
    document.uri,
    params.newName,
    resolveText,
  );
});

connection.onDocumentFormatting((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const result = formatDocument(document.getText(), formatConfig);
  if (result.refused) {
    connection.console.log(`Formatting skipped for ${document.uri}: ${result.refused}`);
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
