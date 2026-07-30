import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { collectWorkspaceIndex, resolveImport, resolveImports } from "../src/workspace.js";

async function fixture(context, files) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "stylus-nm-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return directory;
}

test("glob imports resolve every matched file", async (context) => {
  const directory = await fixture(context, {
    "main.styl": "",
    "parts/a.styl": "",
    "parts/b.styl": "",
    "parts/c.txt": "",
  });
  const mainUri = pathToFileURL(path.join(directory, "main.styl")).href;

  const resolved = resolveImports("parts/*.styl", mainUri);
  assert.equal(resolved.length, 2);
  assert.ok(resolved.every((file) => file.endsWith(".styl")));
});

test("node_modules fallback resolves index, dot-styl and package main", async (context) => {
  const directory = await fixture(context, {
    "src/main.styl": "",
    "node_modules/lib-index/index.styl": "",
    "node_modules/lib-file.styl": "",
    "node_modules/lib-main/package.json": JSON.stringify({ main: "dist/entry" }),
    "node_modules/lib-main/dist/entry.styl": "",
    "node_modules/@scope/pkg/index.styl": "",
  });
  const mainUri = pathToFileURL(path.join(directory, "src/main.styl")).href;

  assert.ok(resolveImport("lib-index", mainUri).endsWith("index.styl"));
  assert.ok(resolveImport("lib-file", mainUri).endsWith("lib-file.styl"));
  assert.ok(resolveImport("lib-main", mainUri).endsWith("dist/entry.styl"));
  assert.ok(resolveImport("@scope/pkg", mainUri).endsWith("index.styl"));
  assert.equal(resolveImport("not-installed", mainUri), null);
});

test("relative paths win over node_modules", async (context) => {
  const directory = await fixture(context, {
    "main.styl": "",
    "lib.styl": "$winner = relative\n",
    "node_modules/lib/index.styl": "$winner = modules\n",
  });
  const mainUri = pathToFileURL(path.join(directory, "main.styl")).href;

  assert.ok(resolveImport("lib", mainUri).endsWith("lib.styl"));
  assert.ok(!resolveImport("lib", mainUri).includes("node_modules"));
});

test("workspace index collects symbols from glob and node_modules imports", async (context) => {
  const directory = await fixture(context, {
    "main.styl": "@import 'parts/*'\n@import 'ui-kit'\n",
    "parts/colors.styl": "$brand = #123\n",
    "parts/spacing.styl": "$gap = 8px\n",
    "node_modules/ui-kit/package.json": JSON.stringify({ main: "index.styl" }),
    "node_modules/ui-kit/index.styl": "kit-mixin()\n  color red\n",
  });
  const mainUri = pathToFileURL(path.join(directory, "main.styl")).href;
  const { index, importClosure } = collectWorkspaceIndex(
    mainUri,
    "@import 'parts/*'\n@import 'ui-kit'\n",
  );

  assert.ok(index.variables.some((v) => v.name === "$brand"));
  assert.ok(index.variables.some((v) => v.name === "$gap"));
  assert.ok(index.functions.some((f) => f.name === "kit-mixin"));
  assert.equal(importClosure.size, 3);
});

test("glob imports are capped", async (context) => {
  const files = { "main.styl": "" };
  for (let i = 0; i < 120; i++) files[`parts/f${String(i).padStart(3, "0")}.styl`] = "";
  const directory = await fixture(context, files);
  const mainUri = pathToFileURL(path.join(directory, "main.styl")).href;

  assert.equal(resolveImports("parts/*.styl", mainUri).length, 100);
});
