import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_STYLELINT_OPTIONS,
  lintDocument,
  resolveStylelintOptions,
} from "../src/lint.js";

const URI = "file:///tmp/lint-test.styl";

const CONFIG = {
  customSyntax: "postcss-styl",
  rules: {
    "declaration-block-no-duplicate-properties": true,
  },
};

test("lint reports rule violations with mapped ranges", async () => {
  const diagnostics = await lintDocument(
    URI,
    ".card\n  color red\n  color blue\n",
    { enable: true, config: CONFIG },
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].source, "stylelint");
  assert.equal(diagnostics[0].code, "declaration-block-no-duplicate-properties");
  assert.deepEqual(diagnostics[0].range.start, { line: 1, character: 2 });
  assert.equal(diagnostics[0].severity, 1);
  assert.match(diagnostics[0].message, /duplicate "color"/);
});

test("lint is silent for clean documents", async () => {
  const diagnostics = await lintDocument(URI, ".card\n  color red\n", {
    enable: true,
    config: CONFIG,
  });
  assert.deepEqual(diagnostics, []);
});

test("stylelint parse failures are filtered out", async () => {
  const diagnostics = await lintDocument(URI, ".card\n  color #ggg\n", {
    enable: true,
    config: { customSyntax: "postcss-styl", rules: { "color-no-invalid-hex": true } },
  });
  assert.deepEqual(diagnostics, []);
});

test("enable false skips linting entirely", async () => {
  const diagnostics = await lintDocument(
    URI,
    ".card\n  color red\n  color blue\n",
    { enable: false, config: CONFIG },
  );
  assert.deepEqual(diagnostics, []);
});

test("missing user configuration resolves to no diagnostics in auto mode", async () => {
  const diagnostics = await lintDocument(URI, ".card\n  color red\n  color blue\n", {
    enable: "auto",
  });
  assert.deepEqual(diagnostics, []);
});

test("resolveStylelintOptions defaults to auto", () => {
  assert.deepEqual(resolveStylelintOptions(undefined), DEFAULT_STYLELINT_OPTIONS);
  assert.deepEqual(resolveStylelintOptions({}), DEFAULT_STYLELINT_OPTIONS);
  assert.deepEqual(resolveStylelintOptions({ stylelint: false }).enable, false);
  assert.deepEqual(
    resolveStylelintOptions({ stylelint: { enable: true, configFile: "/tmp/x.json" } }),
    { enable: true, config: undefined, configFile: "/tmp/x.json" },
  );
});
