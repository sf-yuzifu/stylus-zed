import assert from "node:assert/strict";
import test from "node:test";

import { getColorPresentations, getDocumentColors } from "../src/colors.js";
import { evaluateExpressions, findColorCalls } from "../src/evaluate.js";
import { indexDocument } from "../src/symbols.js";

const URI = "file:///tmp/eval.styl";

const SAMPLE = `$primary = #3498db
$amount = 20%

.card
  color lighten(#3498db, 10%)
  background darken($primary, $amount)
  border-color rgba($primary, 0.5)
  outline-color mix(red, blue, 50%)
  color spin($primary, 30)
  color unknown-fn($primary)
`;

test("finds color call candidates with full spans", () => {
  const lines = SAMPLE.split("\n");
  const candidates = findColorCalls(lines, () => true);

  const names = candidates.map((candidate) => candidate.expression.split("(")[0]);
  assert.ok(names.includes("lighten"));
  assert.ok(names.includes("darken"));
  assert.ok(names.includes("rgba"));
  assert.ok(names.includes("mix"));
  assert.ok(names.includes("spin"));

  const rgbaCall = candidates.find((candidate) => candidate.expression.startsWith("rgba"));
  assert.equal(rgbaCall.expression, "rgba($primary, 0.5)");
});

test("evaluates expressions through the real compiler", () => {
  const index = indexDocument(SAMPLE);
  const candidates = findColorCalls(SAMPLE.split("\n"), () => true);
  const results = evaluateExpressions(URI, index, candidates);

  const lightenIdx = candidates.findIndex((candidate) => candidate.expression.startsWith("lighten"));
  const lighten = results.get(lightenIdx);
  assert.ok(lighten);
  assert.ok(lighten.blue > 0.85 && lighten.red > 0.2);

  const darkenIdx = candidates.findIndex((candidate) => candidate.expression.startsWith("darken"));
  const darken = results.get(darkenIdx);
  assert.ok(darken);
  assert.ok(darken.red < 0.21 && darken.green < 0.6);

  const rgbaIdx = candidates.findIndex((candidate) => candidate.expression.startsWith("rgba"));
  assert.equal(results.get(rgbaIdx).alpha, 0.5);

  const mixIdx = candidates.findIndex((candidate) => candidate.expression.startsWith("mix"));
  const mixed = results.get(mixIdx);
  assert.ok(Math.abs(mixed.red - 0.5) < 0.01 && Math.abs(mixed.blue - 0.5) < 0.01);
});

test("skips unresolvable expressions without failing the batch", () => {
  const source = `.card\n  color lighten($missing, 10%)\n  color darken(#123456, 5%)\n`;
  const index = indexDocument(source);
  const candidates = findColorCalls(source.split("\n"), () => true);
  const results = evaluateExpressions(URI, index, candidates);

  const missingIdx = candidates.findIndex((candidate) => candidate.expression.includes("$missing"));
  const okIdx = candidates.findIndex((candidate) => candidate.expression.startsWith("darken"));

  assert.equal(results.has(missingIdx), false);
  assert.ok(results.has(okIdx));
});

test("problem declarations are excluded without breaking evaluation", () => {
  const source = `$primary = #3498db
$theme = { bg: #fff }
$member = $theme.colors.primary
$continued = foo \\
             bar
$spacing-reset =
  margin: 0

.card
  color lighten(#3498db, 10%)
  background rgba($primary, 0.5)
`;
  const index = indexDocument(source);
  const candidates = findColorCalls(source.split("\n"), () => true);
  const results = evaluateExpressions(URI, index, candidates);

  assert.equal(results.size, 2);
  assert.equal(results.get(1).alpha, 0.5);
});

test("document colors include evaluated swatches at the call range", () => {
  const index = indexDocument(SAMPLE);
  const colors = getDocumentColors(SAMPLE, index, URI);

  const lightenSwatch = colors.find((entry) => entry.range.start.line === 4 && entry.range.start.character === 8);
  assert.ok(lightenSwatch);
  assert.ok(lightenSwatch.color.blue > 0.85);

  const rgbaSwatch = colors.find(
    (entry) => entry.range.start.line === 6 && entry.range.start.character === 15,
  );
  assert.ok(rgbaSwatch);
  assert.equal(rgbaSwatch.color.alpha, 0.5);
});

test("presentations only apply to literal color text", () => {
  const color = { red: 1, green: 0, blue: 0, alpha: 1 };
  const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } };

  assert.equal(getColorPresentations(color, range, "red").length, 3);
  assert.deepEqual(getColorPresentations(color, range, "$primary"), []);
  assert.deepEqual(getColorPresentations(color, range, "lighten(#3498db, 10%)"), []);
});
