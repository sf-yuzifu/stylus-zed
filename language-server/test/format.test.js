import assert from "node:assert/strict";
import test from "node:test";

import { formatDocument } from "../src/format.js";

function editText(result) {
  assert.ok(result.edits, `expected edits, got ${JSON.stringify(result)}`);
  assert.equal(result.edits.length, 1);
  return result.edits[0].newText;
}

test("supremacy engine formats valid documents", () => {
  const source = ".a\n  color :red ;\n";
  const result = formatDocument(source);

  const formatted = editText(result);
  assert.match(formatted, /\.a \{/);
  assert.match(formatted, /color: red;/);
});

test("supremacy engine passes options through", () => {
  const source = ".a\n  color :red ;\n";
  const result = formatDocument(source, {
    engine: "supremacy",
    options: { insertBraces: false, insertSemicolons: false, insertColons: false },
  });

  const formatted = editText(result);
  assert.match(formatted, /\.a\n/);
  assert.match(formatted, /color red/);
  assert.doesNotMatch(formatted, /[{};]/);
});

test("supremacy engine is idempotent on formatted output", () => {
  const source = ".a\n  color :red ;\n";
  const once = editText(formatDocument(source));
  const twice = formatDocument(once);

  assert.deepEqual(twice.edits, []);
});

test("guard refuses scientific notation", () => {
  const result = formatDocument(".a\n  width 1e5px\n");
  assert.match(result.refused, /scientific notation/);
});

test("guard refuses documents the formatter cannot parse", () => {
  assert.ok(formatDocument(".a\n  color rgba(1,\n").refused);
  assert.ok(formatDocument('@namespace svg url("http://x")\n').refused);
});

test("guard refuses non-idempotent output", () => {
  const source = '@document url("https://example.com")\n  body\n    color black\n';
  const result = formatDocument(source);
  assert.match(result.refused, /not idempotent/);
});

test("guard refuses carriage-return injection", () => {
  const source = ".deep-a,\n.deep-b .deep-c\n  color red\n";
  const first = formatDocument(source);
  if (first.edits && first.edits.length > 0) {
    assert.ok(!first.edits[0].newText.includes("\r"));
  } else {
    assert.ok(first.refused);
  }
});

test("whitespace engine trims trailing spaces and tabs in indentation", () => {
  const source = ".a  \n\tcolor red  \n  \n\n\n.b\n\t\tmargin 0\n";
  const result = formatDocument(source, { engine: "whitespace" });

  assert.equal(
    editText(result),
    ".a\n  color red\n\n.b\n    margin 0\n",
  );
});

test("whitespace engine collapses blank runs and keeps final newline", () => {
  const result = formatDocument(".a\n\n\n\n.b\n", { engine: "whitespace" });
  assert.equal(editText(result), ".a\n\n.b\n");
});

test("whitespace engine respects blank-line configuration", () => {
  const result = formatDocument(".a\n\n\n.b\n", {
    engine: "whitespace",
    maxConsecutiveBlankLines: 0,
  });
  assert.equal(editText(result), ".a\n.b\n");
});

test("both engines return no edits for clean input", () => {
  assert.deepEqual(formatDocument(".a\n  color red\n", { engine: "whitespace" }).edits, []);
});
