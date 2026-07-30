import assert from "node:assert/strict";
import test from "node:test";

import { formatIndentStyle } from "../src/formatIndent.js";
import { formatDocument, formatDocumentRange } from "../src/format.js";

function formatted(source, config = {}, options = {}) {
  const result = formatIndentStyle(source, config, options);
  assert.ok(!result.refused, `unexpected refusal: ${result.refused}`);
  return result.formatted;
}

test("indent engine normalizes indentation units", () => {
  const source = ".card\n    color red\n      margin 0\n.other\n  padding 1px\n";
  assert.equal(
    formatted(source),
    ".card\n  color red\n    margin 0\n.other\n  padding 1px\n",
  );
});

test("indent engine converts tabs to the configured unit", () => {
  const source = ".card\n\tcolor red\n\t\tmargin 0\n";
  assert.equal(formatted(source), ".card\n  color red\n    margin 0\n");
});

test("indent engine respects custom units", () => {
  const source = ".card\n  color red\n    margin 0\n";
  assert.equal(
    formatted(source, { tabStopChar: "    " }),
    ".card\n    color red\n        margin 0\n",
  );
});

test("continuation lines stay one unit below their statement", () => {
  const source = ".card\n  box-shadow 0 1px 2px #000,\n              0 2px 4px #000\n";
  assert.equal(
    formatted(source),
    ".card\n  box-shadow 0 1px 2px #000,\n    0 2px 4px #000\n",
  );
});

test("hash blocks and brace style normalize consistently", () => {
  const source = "$theme = {\n    bg: #fff,\n    fg: #333\n}\n.braced {\n  color: red;\n}\n";
  const out = formatted(source);
  assert.match(out, /\$theme = \{\n  bg: #fff,\n  fg: #333\n\}/);
  assert.match(out, /\.braced \{\n  color: red;\n\}/);
});

test("comments follow the surrounding depth", () => {
  const source = ".card\n\t// note\n\tcolor red\n";
  assert.equal(formatted(source), ".card\n  // note\n  color red\n");
});

test("indent engine refuses documents with compiler errors", () => {
  const result = formatIndentStyle(".card\n  color rgba(1, 2)\n", {});
  assert.match(result.refused, /compiler errors/);
});

test("indent engine is idempotent and structure-preserving on example.styl", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("/Users/yuzifu/stylus-zed/example.styl", "utf8");
  const uri = "file:///Users/yuzifu/stylus-zed/example.styl";
  const once = formatted(source, {}, { uri });
  const twice = formatted(once, {}, { uri });
  assert.equal(twice, once);
});

test("indent engine collapses blank runs and keeps final newline", () => {
  assert.equal(
    formatted(".a\n  color red\n\n\n\n.b\n  color blue\n"),
    ".a\n  color red\n\n.b\n  color blue\n",
  );
});

test("formatDocument defaults to the indent engine", () => {
  const result = formatDocument(".card\n    color red\n");
  assert.equal(result.edits[0].newText, ".card\n  color red\n");
});

test("range formatting dedents, formats and re-indents the selection", () => {
  const source = ".card\n    color red\n     margin 0\n.footer\n  padding 1px\n";
  const result = formatDocumentRange(
    source,
    {
      start: { line: 1, character: 4 },
      end: { line: 2, character: 12 },
    },
    { engine: "indent" },
  );

  assert.equal(result.edits.length, 1);
  assert.equal(result.edits[0].newText, "    color red\n      margin 0");
  assert.deepEqual(result.edits[0].range.start, { line: 1, character: 0 });
});

test("range formatting returns no edits when the selection is already clean", () => {
  const source = ".card\n  color red\n";
  const result = formatDocumentRange(
    source,
    { start: { line: 1, character: 0 }, end: { line: 1, character: 12 } },
    { engine: "indent" },
  );
  assert.deepEqual(result.edits, []);
});

test("range formatting with supremacy refuses partial blocks", () => {
  const source = ".card\n  color red\n  margin 0\n";
  const result = formatDocumentRange(
    source,
    { start: { line: 2, character: 2 }, end: { line: 2, character: 10 } },
    { engine: "supremacy", options: {} },
  );
  assert.ok(result.refused);
});

test("range formatting with supremacy formats whole blocks", () => {
  const source = ".card\n  color :red ;\n";
  const result = formatDocumentRange(
    source,
    { start: { line: 0, character: 0 }, end: { line: 1, character: 14 } },
    { engine: "supremacy", options: {} },
  );
  assert.ok(result.edits);
  assert.match(result.edits[0].newText, /\.card \{/);
});
