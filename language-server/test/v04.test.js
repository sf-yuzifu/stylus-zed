import assert from "node:assert/strict";
import test from "node:test";

import { getColorPresentations, getDocumentColors } from "../src/colors.js";
import { formatHex, formatHsl, formatRgb, parseColor } from "../src/data/colors.js";
import { getSignatureHelp, internals } from "../src/signature.js";
import { indexDocument } from "../src/symbols.js";

test("parses hex colors of all widths", () => {
  assert.deepEqual(parseColor("#abc"), {
    red: 0.6666666666666666,
    green: 0.7333333333333333,
    blue: 0.8,
    alpha: 1,
  });
  assert.deepEqual(parseColor("#abcd"), {
    red: 0.6666666666666666,
    green: 0.7333333333333333,
    blue: 0.8,
    alpha: 0.8666666666666667,
  });
  assert.deepEqual(parseColor("#3498db"), {
    red: 0.20392156862745098,
    green: 0.596078431372549,
    blue: 0.8588235294117647,
    alpha: 1,
  });
  assert.equal(parseColor("#12"), null);
});

test("parses rgb/rgba in comma and space forms", () => {
  assert.deepEqual(parseColor("rgb(255, 0, 0)"), {
    red: 1,
    green: 0,
    blue: 0,
    alpha: 1,
  });
  assert.deepEqual(parseColor("rgba(255, 0, 0, 0.5)"), {
    red: 1,
    green: 0,
    blue: 0,
    alpha: 0.5,
  });
  assert.deepEqual(parseColor("rgb(100% 0% 0% / 50%)"), {
    red: 1,
    green: 0,
    blue: 0,
    alpha: 0.5,
  });
});

test("parses hsl/hsla and named colors", () => {
  assert.deepEqual(parseColor("hsl(0, 100%, 50%)"), {
    red: 1,
    green: 0,
    blue: 0,
    alpha: 1,
  });
  assert.deepEqual(parseColor("hsla(120, 100%, 50%, 0.25)"), {
    red: 0,
    green: 1,
    blue: 0,
    alpha: 0.25,
  });
  assert.deepEqual(parseColor("rebeccapurple"), {
    red: 0.4,
    green: 0.2,
    blue: 0.6,
    alpha: 1,
  });
  assert.equal(parseColor("not-a-color"), null);
});

test("formats colors as hex, rgb and hsl", () => {
  const red = { red: 1, green: 0, blue: 0, alpha: 1 };
  assert.equal(formatHex(red), "#ff0000");
  assert.equal(formatRgb(red), "rgb(255, 0, 0)");
  assert.equal(formatHsl(red), "hsl(0, 100%, 50%)");

  const translucent = { red: 0, green: 0, blue: 0, alpha: 0.5 };
  assert.equal(formatHex(translucent), "#00000080");
  assert.equal(formatRgb(translucent), "rgba(0, 0, 0, 0.5)");
  assert.equal(formatHsl(translucent), "hsla(0, 0%, 0%, 0.5)");
});

test("finds literal colors and skips selectors and comments", () => {
  const source = `// color #fff should not count
$primary = #3498db

.card
  color $primary
  background rgb(255, 0, 0)
  border-color rebeccapurple
#fff
  color red
/* #000 */
`;
  const colors = getDocumentColors(source, indexDocument(source));

  const byText = colors.map((entry) => ({
    line: entry.range.start.line,
    start: entry.range.start.character,
  }));

  assert.ok(byText.some((c) => c.line === 1 && c.start === 11)); // #3498db decl
  assert.ok(byText.some((c) => c.line === 4 && c.start === 8)); // $primary usage
  assert.ok(byText.some((c) => c.line === 5 && c.start === 13)); // rgb(...)
  assert.ok(byText.some((c) => c.line === 6 && c.start === 15)); // rebeccapurple
  assert.ok(byText.some((c) => c.line === 8 && c.start === 8)); // red value
  assert.ok(!byText.some((c) => c.line === 0)); // line comment
  assert.ok(!byText.some((c) => c.line === 7)); // #fff selector
  assert.ok(!byText.some((c) => c.line === 9)); // block comment
});

test("color presentations offer hex, rgb and hsl edits", () => {
  const range = {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 3 },
  };
  const presentations = getColorPresentations(
    { red: 1, green: 0, blue: 0, alpha: 1 },
    range,
  );

  assert.deepEqual(
    presentations.map((presentation) => presentation.label),
    ["#ff0000", "rgb(255, 0, 0)", "hsl(0, 100%, 50%)"],
  );
  assert.deepEqual(presentations[0].textEdit, {
    range,
    newText: "#ff0000",
  });
});

const SIGNATURE_SAMPLE = `border-radius(r = 5px, spread = 2px)
  border-radius r spread

.card
  border-radius(8px, 4px)
  color rgba(lighten(#333, 10%), 0.5)
`;

test("finds the innermost call context", () => {
  assert.deepEqual(internals.findCallContext(SIGNATURE_SAMPLE, { line: 4, character: 16 }), {
    name: "border-radius",
    line: 4,
    character: 15,
  });
  const nested = internals.findCallContext(SIGNATURE_SAMPLE, { line: 5, character: 21 });
  assert.equal(nested.name, "lighten");
  const outer = internals.findCallContext(SIGNATURE_SAMPLE, { line: 5, character: 33 });
  assert.equal(outer.name, "rgba");
});

test("counts the active parameter across nested calls", () => {
  assert.equal(
    internals.countActiveParameter(
      SIGNATURE_SAMPLE,
      { name: "rgba", line: 5, character: 12 },
      { line: 5, character: 33 },
    ),
    1,
  );
  assert.equal(
    internals.countActiveParameter(
      SIGNATURE_SAMPLE,
      { name: "border-radius", line: 4, character: 15 },
      { line: 4, character: 21 },
    ),
    1,
  );
});

test("signature help for user mixins uses declared params", () => {
  const help = getSignatureHelp(SIGNATURE_SAMPLE, { line: 4, character: 17 }, indexDocument(SIGNATURE_SAMPLE));

  assert.equal(help.signatures[0].label, "border-radius(r = 5px, spread = 2px)");
  assert.deepEqual(
    help.signatures[0].parameters.map((param) => param.label),
    ["r = 5px", "spread = 2px"],
  );
  assert.equal(help.activeParameter, 0);
});

test("signature help for builtins uses runtime signatures", () => {
  const help = getSignatureHelp(SIGNATURE_SAMPLE, { line: 5, character: 33 }, indexDocument(SIGNATURE_SAMPLE));

  assert.equal(help.signatures[0].label, "rgba(r, g, b, a | color, alpha)");
  assert.equal(help.activeParameter, 1);
});

test("signature help is null outside calls and for unknown callees", () => {
  const index = indexDocument(SIGNATURE_SAMPLE);
  assert.equal(getSignatureHelp(SIGNATURE_SAMPLE, { line: 0, character: 3 }, index), null);
  assert.equal(getSignatureHelp(".a\n  unknown-call(1)", { line: 1, character: 16 }, index), null);
});
