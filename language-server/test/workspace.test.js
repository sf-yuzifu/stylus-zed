import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { getCompletions } from "../src/completion.js";
import { getDefinition, getReferences, getRenameEdits } from "../src/navigation.js";
import { getHover } from "../src/hover.js";
import { collectWorkspaceIndex, importSpecs, resolveImport } from "../src/workspace.js";

async function fixture(context, files) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "stylus-ws-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return directory;
}

test("parses import specs and skips CSS and URLs", () => {
  const specs = importSpecs(`@import 'a'
@import "dir/b.styl"
@require 'c'
@import url('https://x.com/a.css')
@import 'theme.css'
`);
  assert.deepEqual(specs, ["a", "dir/b.styl", "c"]);
});

test("resolves imports with stylus lookup rules", async (context) => {
  const directory = await fixture(context, {
    "main.styl": "",
    "a.styl": "",
    "lib/index.styl": "",
  });

  const mainUri = pathToFileURL(path.join(directory, "main.styl")).href;
  assert.ok(resolveImport("a", mainUri).endsWith("a.styl"));
  assert.ok(resolveImport("a.styl", mainUri).endsWith("a.styl"));
  assert.ok(resolveImport("lib", mainUri).endsWith("index.styl"));
  assert.equal(resolveImport("missing", mainUri), null);
});

test("collects root symbols through an import chain", async (context) => {
  const directory = await fixture(context, {
    "main.styl": "@import 'vars'\n.card\n  color $primary\n",
    "vars.styl": "@import 'base'\n$secondary = blue\n",
    "base.styl": "// 主色\n$primary = #3498db\nmixin-root(a)\n  margin a\n$local-shadow = 1px\n",
  });

  const mainUri = pathToFileURL(path.join(directory, "main.styl")).href;
  const text = '@import "vars"\n.card\n  color $primary\n';
  const { index, files } = collectWorkspaceIndex(mainUri, text);

  const names = index.variables.map((v) => v.name);
  assert.ok(names.includes("$primary"));
  assert.ok(names.includes("$secondary"));
  assert.ok(index.functions.some((f) => f.name === "mixin-root"));
  assert.ok(files.length === 3);

  const primary = index.variables.find((v) => v.name === "$primary");
  assert.ok(primary.imported);
  assert.ok(primary.uri.endsWith("base.styl"));
});

test("import cycles do not hang", async (context) => {
  const directory = await fixture(context, {
    "a.styl": "@import 'b'\n$a-var = 1\n",
    "b.styl": "@import 'a'\n$b-var = 2\n",
  });

  const aUri = pathToFileURL(path.join(directory, "a.styl")).href;
  const { index } = collectWorkspaceIndex(aUri, "@import 'b'\n$a-var = 1\n");

  assert.ok(index.variables.some((v) => v.name === "$b-var"));
});

test("missing imports are ignored", async (context) => {
  const directory = await fixture(context, { "main.styl": "" });
  const mainUri = pathToFileURL(path.join(directory, "main.styl")).href;
  const { index } = collectWorkspaceIndex(mainUri, "@import 'not-here'\n$x = 1\n");

  assert.deepEqual(index.variables.map((v) => v.name), ["$x"]);
});

test("completion and hover include imported symbols with origin", async (context) => {
  const directory = await fixture(context, {
    "vars.styl": "// 主色\n$primary = #3498db\n",
  });
  const mainUri = pathToFileURL(path.join(directory, "main.styl")).href;
  const text = '@import "vars"\n.card\n  color $primary\n';
  const { index } = collectWorkspaceIndex(mainUri, text);

  const items = getCompletions(text, { line: 2, character: 9 }, index);
  const primary = items.find((item) => item.label === "$primary");
  assert.ok(primary);
  assert.match(primary.detail, /vars\.styl/);

  const hover = getHover(text, { line: 2, character: 10 }, index);
  assert.match(hover.contents.value, /vars\.styl/);
});

test("definition jumps into the imported file", async (context) => {
  const directory = await fixture(context, {
    "main.styl": "@import 'vars'\n.card\n  color $primary\n",
    "vars.styl": "// 主色\n$primary = #3498db\n",
  });
  const mainPath = path.join(directory, "main.styl");
  const varsUri = pathToFileURL(path.join(directory, "vars.styl")).href;
  const mainUri = pathToFileURL(mainPath).href;
  const text = "@import 'vars'\n.card\n  color $primary\n";
  const { index } = collectWorkspaceIndex(mainUri, text);

  const definition = getDefinition(text, { line: 2, character: 9 }, index, mainUri, (uri) => {
    if (uri === varsUri) return "// 主色\n$primary = #3498db\n";
    return null;
  });

  assert.equal(definition.uri, varsUri);
  assert.deepEqual(definition.range.start, { line: 1, character: 0 });
});

test("references and rename cover the imported declaration", async (context) => {
  const directory = await fixture(context, {
    "vars.styl": "$primary = red\n",
  });
  const varsUri = pathToFileURL(path.join(directory, "vars.styl")).href;
  const mainUri = pathToFileURL(path.join(directory, "main.styl")).href;
  const text = '@import "vars"\n.card\n  color $primary\n';
  const { index } = collectWorkspaceIndex(mainUri, text);
  const resolveText = (uri) => (uri === varsUri ? "$primary = red\n" : null);

  const references = getReferences(text, { line: 2, character: 9 }, index, mainUri, true, resolveText);
  assert.ok(references.some((ref) => ref.uri === varsUri));
  assert.ok(references.some((ref) => ref.uri === mainUri));

  const edits = getRenameEdits(text, { line: 2, character: 9 }, index, mainUri, "accent", resolveText);
  assert.ok(edits.changes[varsUri]);
  assert.ok(edits.changes[mainUri]);
  assert.equal(edits.changes[varsUri][0].newText, "$accent");
});
