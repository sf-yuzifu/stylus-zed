import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { internals, validateStylus } from "../src/diagnostics.js";

test("accepts indentation and brace syntax", () => {
  const source = [
    "primary = #c00",
    "",
    "button",
    "  color primary",
    "  &:hover { color: blue; }",
  ].join("\n");

  assert.deepEqual(
    validateStylus("file:///tmp/valid.styl", source),
    { uri: "file:///tmp/valid.styl", diagnostics: [] },
  );
});

test("maps a parser error to its reported position", () => {
  const result = validateStylus(
    "file:///tmp/invalid.styl",
    "body\n  color red\n  broken(",
  );

  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(result.diagnostics[0].range.start, {
    line: 2,
    character: 9,
  });
  assert.equal(result.diagnostics[0].code, "ParseError");
  assert.equal(result.diagnostics[0].message, 'failed to find closing paren ")"');
});

test("reports compiler evaluation errors without the code frame", () => {
  const result = validateStylus(
    "file:///tmp/compiler-error.styl",
    "body\n  color rgba(1, 2)",
  );

  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(result.diagnostics[0].range.start, {
    line: 1,
    character: 8,
  });
  assert.match(result.diagnostics[0].message, /^TypeError: expected rgba or hsla/);
  assert.doesNotMatch(result.diagnostics[0].message, /\| color rgba/);
});

test("uses the imported file URI for dependency errors", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "stylus-lsp-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const entry = path.join(directory, "entry.styl");
  const dependency = path.join(directory, "dependency.styl");
  await writeFile(dependency, "part\n  broken(");

  const result = validateStylus(pathToFileURL(entry).href, '@import "dependency"');

  assert.equal(result.uri, pathToFileURL(dependency).href);
  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(result.diagnostics[0].range.start, {
    line: 1,
    character: 9,
  });
});

test("supports glob imports with the security-patched glob override", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "stylus-lsp-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const parts = path.join(directory, "parts");
  const entry = path.join(directory, "entry.styl");
  await mkdir(parts);
  await writeFile(path.join(parts, "colors.styl"), "primary = #c00\n");

  const source = '@import "parts/*.styl"\nbody\n  color primary';
  assert.deepEqual(validateStylus(pathToFileURL(entry).href, source), {
    uri: pathToFileURL(entry).href,
    diagnostics: [],
  });
});

test("parses formatted locations with Windows drive letters", () => {
  const location = internals.locationFromError(
    new Error("C:\\work\\theme.styl:12:7\n   12| broken\n\nUnexpected token"),
    "fallback.styl",
  );

  assert.deepEqual(location, {
    filename: "C:\\work\\theme.styl",
    lineno: 12,
    column: 7,
  });
});

test("uses UTF-16 positions for astral characters", () => {
  assert.deepEqual(
    internals.diagnosticRange(
      { filename: "test.styl", lineno: 1, column: 1 },
      "😀x",
    ),
    {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 2 },
    },
  );
});
