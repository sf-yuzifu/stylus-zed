import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefinition,
  getPrepareRename,
  getReferences,
  getRenameEdits,
} from "../src/navigation.js";
import { indexDocument, resolveVariable } from "../src/symbols.js";

const URI = "file:///tmp/nav.styl";

const SAMPLE = `$primary = #3498db
$size = 10px

border-radius(r = 5px)
  border-radius r

.card
  $size = 20px
  width $size
  color $primary
  border-radius(8px)

.other
  width $size
  color $primary
`;

test("resolves variables with scope awareness", () => {
  const index = indexDocument(SAMPLE);

  const outer = resolveVariable(index, "$size", 13);
  assert.equal(outer.value, "10px");
  assert.equal(outer.line, 1);

  const inner = resolveVariable(index, "$size", 8);
  assert.equal(inner.value, "20px");
  assert.equal(inner.line, 7);

  assert.equal(resolveVariable(index, "$size", 6).line, 1);
});

test("resolves parameters as innermost scope", () => {
  const index = indexDocument(SAMPLE);
  const param = resolveVariable(index, "r", 4);

  assert.equal(param.kind, "param");
  assert.equal(param.line, 3);
});

test("definition jumps to the scoped declaration", () => {
  const index = indexDocument(SAMPLE);

  const def = getDefinition(SAMPLE, { line: 8, character: 9 }, index, URI);
  assert.deepEqual(def.range.start, { line: 7, character: 2 });

  const outerDef = getDefinition(SAMPLE, { line: 13, character: 9 }, index, URI);
  assert.deepEqual(outerDef.range.start, { line: 1, character: 0 });

  const mixinDef = getDefinition(SAMPLE, { line: 10, character: 4 }, index, URI);
  assert.deepEqual(mixinDef.range.start, { line: 3, character: 0 });
});

test("definition on the declaration itself returns the declaration", () => {
  const index = indexDocument(SAMPLE);
  const def = getDefinition(SAMPLE, { line: 0, character: 3 }, index, URI);
  assert.deepEqual(def.range.start, { line: 0, character: 0 });
});

test("definition returns null for unknown tokens", () => {
  const index = indexDocument(SAMPLE);
  assert.equal(getDefinition(SAMPLE, { line: 8, character: 3 }, index, URI), null);
});

test("references respect shadowing", () => {
  const index = indexDocument(SAMPLE);
  const outerRefs = getReferences(SAMPLE, { line: 13, character: 9 }, index, URI, true);
  const lines = outerRefs.map((ref) => ref.range.start.line).sort((a, b) => a - b);

  assert.deepEqual(lines, [1, 13]);

  const innerRefs = getReferences(SAMPLE, { line: 8, character: 9 }, index, URI, true);
  const innerLines = innerRefs.map((ref) => ref.range.start.line).sort((a, b) => a - b);
  assert.deepEqual(innerLines, [7, 8]);
});

test("references include all call sites of a mixin", () => {
  const index = indexDocument(SAMPLE);
  const refs = getReferences(SAMPLE, { line: 10, character: 4 }, index, URI, true);
  const lines = refs.map((ref) => ref.range.start.line).sort((a, b) => a - b);

  assert.deepEqual(lines, [3, 10]);
});

test("references can exclude the declaration", () => {
  const index = indexDocument(SAMPLE);
  const refs = getReferences(SAMPLE, { line: 9, character: 9 }, index, URI, false);

  assert.deepEqual(
    refs.map((ref) => ref.range.start.line),
    [9, 14],
  );
});

test("references skip comments", () => {
  const source = "$primary = red\n// color $primary\n.card\n  color $primary\n";
  const index = indexDocument(source);
  const refs = getReferences(source, { line: 3, character: 9 }, index, URI, true);

  assert.deepEqual(
    refs.map((ref) => ref.range.start.line),
    [0, 3],
  );
});

test("prepare rename returns the token range", () => {
  const index = indexDocument(SAMPLE);
  const prepared = getPrepareRename(SAMPLE, { line: 9, character: 10 }, index);

  assert.equal(prepared.placeholder, "primary");
  assert.deepEqual(prepared.range.start, { line: 9, character: 8 });
});

test("indexes block assignments with empty values", () => {
  const source = `$reset = @block {
  margin: 0
}

$spacing-reset =
  margin: 0
  padding: 0

.apply-block
  {$reset}

.apply-block-alt
  {$spacing-reset}
`;
  const index = indexDocument(source);

  const spacing = resolveVariable(index, "$spacing-reset", 12);
  assert.equal(spacing.value, "@block");
  assert.equal(spacing.line, 4);

  const reset = resolveVariable(index, "$reset", 9);
  assert.equal(reset.line, 0);

  const definition = getDefinition(source, { line: 12, character: 4 }, index, URI);
  assert.deepEqual(definition.range.start, { line: 4, character: 0 });
});

test("assignment operators do not match equality", () => {
  const index = indexDocument(".compare\n  if $base-size == 16px\n    color blue\n");
  assert.deepEqual(index.variables, []);
});

test("rename edits preserve each occurrence's dollar form", () => {
  const source = "$primary = red\n.card\n  color $primary\n  border-color primary\n";
  const index = indexDocument(source);
  const edits = getRenameEdits(source, { line: 2, character: 9 }, index, URI, "$accent");

  assert.deepEqual(edits.changes[URI].map((edit) => edit.newText), [
    "$accent",
    "$accent",
    "accent",
  ]);
});
