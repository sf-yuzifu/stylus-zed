#!/usr/bin/env node

import {
  createConnection,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { validateStylus } from "../src/diagnostics.js";
import { getCompletions } from "../src/completion.js";
import { getHover } from "../src/hover.js";
import { indexDocument } from "../src/symbols.js";

const CHANGE_DEBOUNCE_MS = 200;
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const timers = new Map();
const resultsByDocument = new Map();
const symbolCache = new Map();

connection.onInitialize(() => ({
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
  },
  serverInfo: {
    name: "stylus-language-server",
    version: "0.3.0",
  },
}));

function symbolsFor(document) {
  const cached = symbolCache.get(document.uri);
  if (cached && cached.version === document.version) return cached.index;
  const index = indexDocument(document.getText());
  symbolCache.set(document.uri, { version: document.version, index });
  return index;
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
