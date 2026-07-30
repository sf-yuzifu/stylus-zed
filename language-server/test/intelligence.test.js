import assert from "node:assert/strict";
import test from "node:test";

import { getCompletions } from "../src/completion.js";
import { getBuiltin, listBuiltins } from "../src/data/builtins.js";
import { getHover } from "../src/hover.js";
import { findVariable, indexDocument } from "../src/symbols.js";

const SAMPLE = `// 主色
$primary = #3498db
legacy-var = red

// 圆角 mixin
border-radius(r = 5px)
  border-radius r

.card
  border-radius(8px)
  color $primary
  &:hover
    color lighten($primary, 10%)
`;

test("indexes variables and mixin definitions with docs", () => {
  const index = indexDocument(SAMPLE);

  const primary = findVariable(index, "$primary");
  assert.equal(primary.value, "#3498db");
  assert.equal(primary.doc, "主色");

  const legacy = findVariable(index, "legacy-var");
  assert.equal(legacy.value, "red");

  assert.equal(index.functions.length, 1);
  assert.equal(index.functions[0].name, "border-radius");
  assert.equal(index.functions[0].params, "r = 5px");
  assert.equal(index.functions[0].doc, "圆角 mixin");
});

test("indexer survives broken intermediate documents", () => {
  const broken = `$primary = #3498db

.card
  border-radius(
  color $primary
`;
  const index = indexDocument(broken);
  assert.ok(findVariable(index, "$primary"));
  assert.equal(index.functions.length, 0);
});

test("indexer ignores hash pairs and multi-line params", () => {
  const source = `$theme = { bg: #fff, fg: #333 }

multi-line-params(
  x = 5
, y = 10
)
  padding y x
`;
  const index = indexDocument(source);
  assert.deepEqual(
    index.variables.map((variable) => variable.name),
    ["$theme"],
  );
  assert.equal(index.functions.length, 0);
});

test("builtin registry merges curated docs with runtime signatures", () => {
  const lighten = getBuiltin("lighten");
  assert.equal(lighten.signature, "lighten(color, amount)");
  assert.ok(lighten.description.length > 0);

  const names = listBuiltins().map((builtin) => builtin.name);
  assert.ok(names.includes("rgba"));
  assert.ok(names.includes("s"));
  assert.ok(!names.includes("-math-prop"));
  assert.ok(!names.includes("require-color"));
  assert.ok(!names.includes("quote"));
});

test("value context offers property values, variables and builtins", () => {
  const index = indexDocument(SAMPLE);
  const items = getCompletions(SAMPLE, { line: 10, character: 8 }, index);
  const labels = items.map((item) => item.label);

  assert.ok(labels.includes("$primary"));
  assert.ok(labels.includes("legacy-var"));
  assert.ok(labels.includes("lighten"));
  assert.ok(labels.includes("border-radius"));
});

test("dollar context offers only visible variables", () => {
  const index = indexDocument(SAMPLE);
  const items = getCompletions(SAMPLE, { line: 10, character: 9 }, index);

  assert.deepEqual(
    items.map((item) => item.label).sort(),
    ["$primary", "legacy-var"],
  );
});

test("dollar context inside a function body offers its parameters", () => {
  const index = indexDocument(SAMPLE);
  const insideBody = getCompletions(
    SAMPLE.replace("  border-radius r", "  border-radius $"),
    { line: 6, character: 17 },
    index,
  );

  assert.ok(insideBody.some((item) => item.label === "r"));
});

test("at-rule context offers CSS at-rules and Stylus additions", () => {
  const items = getCompletions("@m", { line: 0, character: 2 }, indexDocument(""));
  const labels = items.map((item) => item.label);

  assert.ok(labels.includes("@media"));
  assert.ok(labels.includes("@block"));
  assert.ok(labels.includes("@extend"));
});

test("pseudo context offers pseudo classes and elements", () => {
  const items = getCompletions(
    SAMPLE,
    { line: 11, character: 7 },
    indexDocument(SAMPLE),
  );
  const labels = items.map((item) => item.label);

  assert.ok(labels.includes(":hover"));
  assert.ok(labels.includes("::before"));
});

test("statement context offers properties, mixins and root tags", () => {
  const index = indexDocument(SAMPLE);

  const nested = getCompletions(SAMPLE, { line: 8, character: 4 }, index);
  const nestedLabels = nested.map((item) => item.label);
  assert.ok(nestedLabels.includes("color"));
  assert.ok(nestedLabels.includes("border-radius"));
  assert.ok(!nestedLabels.includes("div"));

  const root = getCompletions("di", { line: 0, character: 2 }, index);
  const rootLabels = root.map((item) => item.label);
  assert.ok(rootLabels.includes("div"));
  assert.ok(rootLabels.includes("display"));
});

test("call argument context offers variables and builtins", () => {
  const source = ".card\n  color rgba(\n";
  const items = getCompletions(source, { line: 1, character: 13 }, indexDocument(source));
  const labels = items.map((item) => item.label);

  assert.ok(labels.includes("rgba"));
  assert.ok(labels.includes("lighten"));
});

test("hover shows variable declarations with docs", () => {
  const hover = getHover(SAMPLE, { line: 10, character: 10 }, indexDocument(SAMPLE));

  assert.match(hover.contents.value, /\$primary = #3498db/);
  assert.match(hover.contents.value, /主色/);
  assert.deepEqual(hover.range.start, { line: 10, character: 8 });
});

test("hover shows mixin signatures", () => {
  const hover = getHover(SAMPLE, { line: 9, character: 5 }, indexDocument(SAMPLE));

  assert.match(hover.contents.value, /border-radius\(r = 5px\)/);
});

test("hover shows builtin documentation", () => {
  const source = ".card\n  color lighten($primary, 10%)\n";
  const hover = getHover(source, { line: 1, character: 10 }, indexDocument(source));

  assert.match(hover.contents.value, /lighten\(color, amount\)/);
  assert.match(hover.contents.value, /Lightens color/);
});

test("hover shows CSS property documentation on declarations", () => {
  const hover = getHover(SAMPLE, { line: 10, character: 4 }, indexDocument(SAMPLE));

  assert.match(hover.contents.value, /color: <color>/);
  assert.match(hover.contents.value, /MDN Reference/);
});

test("hover returns null for unknown selectors", () => {
  const hover = getHover(SAMPLE, { line: 7, character: 3 }, indexDocument(SAMPLE));
  assert.equal(hover, null);
});
