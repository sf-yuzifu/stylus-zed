import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { indexDocument } from "../src/symbols.js";
import { reverseReachable } from "../src/workspaceFiles.js";
import {
  getDocumentSymbols,
  getWorkspaceReferences,
  getWorkspaceRenameEdits,
} from "../src/workspaceRefs.js";

async function fixture(context, files) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "stylus-wsrefs-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(directory, name), content);
  }
  return directory;
}

function uriOf(directory, name) {
  return pathToFileURL(path.join(directory, name)).href;
}

function setup(directory) {
  const texts = new Map();
  for (const name of ["base.styl", "a.styl", "b.styl", "c.styl", "main.styl"]) {
    try {
      texts.set(uriOf(directory, name), readFileSync(path.join(directory, name), "utf8"));
    } catch {
      // file may not exist in this fixture
    }
  }

  const resolveText = (uri) => texts.get(uri) ?? null;
  const collect = (uri) => {
    const text = resolveText(uri);
    if (text == null) return null;
    const { index, importClosure } = indexAndClosure(uri, text);
    return { index, importClosure };
  };
  return { resolveText, collect };
}

import { collectWorkspaceIndex } from "../src/workspace.js";
function indexAndClosure(uri, text) {
  return collectWorkspaceIndex(uri, text);
}

const FILES = {
  "base.styl": "$primary = red\nmixin-base(a)\n  margin a\n",
  "a.styl": "@import 'base'\n.a\n  color $primary\n  mixin-base(1px)\n",
  "b.styl": "@import 'a'\n.b\n  border-color $primary\n",
  "c.styl": "$primary = blue\n.c\n  color $primary\n",
  "main.styl": "@import 'base'\n.main\n  background $primary\n",
};

test("reverse reachability follows the import graph upstream", async (context) => {
  const directory = await fixture(context, FILES);
  const { resolveText } = setup(directory);
  const candidates = Object.keys(FILES).map((name) => uriOf(directory, name));

  const reachable = reverseReachable(uriOf(directory, "base.styl"), candidates, resolveText);

  assert.ok(reachable.has(uriOf(directory, "a.styl")));
  assert.ok(reachable.has(uriOf(directory, "b.styl")));
  assert.ok(reachable.has(uriOf(directory, "main.styl")));
  assert.ok(!reachable.has(uriOf(directory, "c.styl")));
});

test("workspace references cover every importing file and skip shadows", async (context) => {
  const directory = await fixture(context, FILES);
  const { resolveText, collect } = setup(directory);
  const mainUri = uriOf(directory, "main.styl");
  const text = resolveText(mainUri);
  const { index } = collect(mainUri);
  const candidates = Object.keys(FILES).map((name) => uriOf(directory, name));
  const visible = reverseReachable(uriOf(directory, "base.styl"), candidates, resolveText);

  const references = getWorkspaceReferences({
    text,
    position: { line: 2, character: 15 },
    index,
    uri: mainUri,
    includeDeclaration: true,
    resolveText,
    listCandidateUris: () => [...visible],
    indexForFile: collect,
  });

  const byUri = new Map();
  for (const ref of references) {
    byUri.set(ref.uri, (byUri.get(ref.uri) ?? 0) + 1);
  }

  assert.equal(byUri.get(uriOf(directory, "base.styl")), 1);
  assert.equal(byUri.get(uriOf(directory, "a.styl")), 1);
  assert.equal(byUri.get(uriOf(directory, "b.styl")), 1);
  assert.equal(byUri.get(mainUri), 1);
  assert.equal(byUri.get(uriOf(directory, "c.styl")), undefined);
});

test("workspace rename edits span all visible files", async (context) => {
  const directory = await fixture(context, FILES);
  const { resolveText, collect } = setup(directory);
  const mainUri = uriOf(directory, "main.styl");
  const text = resolveText(mainUri);
  const { index } = collect(mainUri);
  const candidates = Object.keys(FILES).map((name) => uriOf(directory, name));
  const visible = reverseReachable(uriOf(directory, "base.styl"), candidates, resolveText);

  const edits = getWorkspaceRenameEdits({
    text,
    position: { line: 2, character: 15 },
    index,
    uri: mainUri,
    newName: "accent",
    resolveText,
    listCandidateUris: () => [...visible],
    indexForFile: collect,
  });

  assert.equal(Object.keys(edits.changes).length, 4);
  for (const uri of Object.keys(edits.changes)) {
    assert.ok(uri.endsWith("base.styl") || uri.endsWith("a.styl") || uri.endsWith("b.styl") || uri.endsWith("main.styl"));
    assert.ok(edits.changes[uri].every((edit) => edit.newText === "$accent"));
  }
});

test("document symbols list file-local variables and functions", () => {
  const text = "// 主色\n$primary = red\n$local = 1px\n\nborder-radius(r = 5px)\n  border-radius r\n\n.card\n  color $primary\n";
  const index = indexDocument(text);
  const symbols = getDocumentSymbols(text, index);

  assert.deepEqual(
    symbols.map((symbol) => [symbol.name, symbol.kind]),
    [
      ["$primary", 13],
      ["$local", 13],
      ["border-radius", 12],
    ],
  );
  assert.deepEqual(symbols[0].selectionRange.start, { line: 1, character: 0 });
  assert.deepEqual(symbols[2].range.end.line, 5);
});
