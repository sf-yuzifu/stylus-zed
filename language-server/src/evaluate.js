import path from "node:path";
import { fileURLToPath } from "node:url";

import stylus from "stylus";

import { parseColor } from "./data/colors.js";
import { getBuiltin } from "./data/builtins.js";

const COLOR_FUNCTIONS = new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "lighten",
  "darken",
  "saturate",
  "desaturate",
  "fade-in",
  "fade-out",
  "spin",
  "mix",
  "invert",
  "complement",
  "grayscale",
  "tint",
  "shade",
  "blend",
  "transparentify",
  "adjust",
]);

const CALL_RE = /\b([a-zA-Z][\w-]*)\(/g;
const PROBE_RE = /probe-(\d+):\s*([^;]+);/g;

function callSpan(line, matchEnd) {
  let depth = 1;
  let quote = null;
  for (let i = matchEnd; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === quote && line[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

export function findColorCalls(lines, isCandidatePosition) {
  const candidates = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];
    CALL_RE.lastIndex = 0;
    let match;
    while ((match = CALL_RE.exec(line)) !== null) {
      const name = match[1];
      if (!COLOR_FUNCTIONS.has(name)) continue;
      if (!isCandidatePosition(line, match.index, lineNumber)) continue;

      const end = callSpan(line, match.index + match[0].length);
      if (end === -1) continue;

      const expression = line.slice(match.index, end);
      if (parseColor(expression) !== null) continue;

      candidates.push({
        expression,
        line: lineNumber,
        start: match.index,
        end,
      });
    }
  }

  return candidates;
}

const TOKEN_RE = /\$?[\w$-]+/g;
const FN_RE = /([\w-]+)\(/g;

function declarationIsSelfContained(value, available, declaredNames) {
  TOKEN_RE.lastIndex = 0;
  let match;
  while ((match = TOKEN_RE.exec(value)) !== null) {
    const before = match.index > 0 ? value[match.index - 1] : "";
    if (before === "." || before === "@" || before === "#") continue;
    const token = match[0];
    const isReference = token.startsWith("$") || declaredNames.has(token);
    if (isReference && !available.has(token.replace(/^\$/, ""))) {
      return false;
    }
  }

  FN_RE.lastIndex = 0;
  while ((match = FN_RE.exec(value)) !== null) {
    if (!getBuiltin(match[1])) return false;
  }
  return true;
}

function declarationLinesFor(index) {
  const declaredNames = new Set(
    index.variables.map((variable) => variable.name.replace(/^\$/, "")),
  );

  const imported = index.variables.filter((variable) => variable.imported);
  const local = index.variables
    .filter(
      (variable) =>
        !variable.imported && variable.indent === 0 && variable.kind === "variable",
    )
    .sort((a, b) => a.line - b.line);

  const lines = [];
  const available = new Set();
  for (const variable of [...imported, ...local]) {
    const plain = variable.name.replace(/^\$/, "");
    const value = variable.value;
    if (value.includes("{") || value.includes("@block")) continue;
    if (value.endsWith("\\")) continue;
    if (!declarationIsSelfContained(value, available, declaredNames)) continue;
    available.add(plain);
    lines.push(`${variable.name} = ${value}`);
  }
  return lines;
}

function renderProbeSource(declarationLines, expressions, filename) {
  const probes = expressions
    .map((expression, i) => `  probe-${i}: ${expression}`)
    .join("\n");
  const source = `${declarationLines.join("\n")}\nprobe\n${probes}\n`;
  return stylus.render(source, { filename, cache: false });
}

function parseProbeResults(css) {
  const results = new Map();
  PROBE_RE.lastIndex = 0;
  let match;
  while ((match = PROBE_RE.exec(css)) !== null) {
    const color = parseColor(match[2].trim());
    if (color) results.set(Number(match[1]), color);
  }
  return results;
}

function probeFilename(uri) {
  try {
    const filePath = fileURLToPath(uri);
    return path.join(path.dirname(filePath), "__stylus_lsp_probe__.styl");
  } catch {
    return "__stylus_lsp_probe__.styl";
  }
}

export function evaluateExpressions(uri, index, candidates) {
  const results = new Map();
  if (candidates.length === 0) return results;

  const declarationLines = declarationLinesFor(index);
  const filename = probeFilename(uri);
  const expressions = candidates.map((candidate) => candidate.expression);

  let batchSucceeded = false;
  try {
    const css = renderProbeSource(declarationLines, expressions, filename);
    for (const [probeIndex, color] of parseProbeResults(css)) {
      if (candidates[probeIndex]) {
        results.set(probeIndex, color);
        batchSucceeded = true;
      }
    }
  } catch {
    batchSucceeded = false;
  }

  if (batchSucceeded && results.size === candidates.length) return results;

  for (let i = 0; i < candidates.length; i++) {
    if (results.has(i)) continue;
    try {
      const single = renderProbeSource(declarationLines, [expressions[i]], filename);
      const color = parseProbeResults(single).get(0);
      if (color) results.set(i, color);
    } catch {
      // not evaluable in isolation (function params, user mixins, etc.)
    }
  }

  return results;
}
