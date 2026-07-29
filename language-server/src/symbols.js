const KEYWORDS = new Set([
  "if",
  "else",
  "unless",
  "for",
  "in",
  "while",
  "return",
  "not",
  "and",
  "or",
]);

const VARIABLE_RE = /^(\s*)(\$?[\w$-]+)\s*(=|\?=|:=)\s*(.+?)\s*(?:\/\/.*)?$/;
const FUNCTION_RE = /^(\s*)([a-zA-Z_-][\w$-]*)\(([^)]*)\)\s*(\{.*\})?\s*$/;

function parenDelta(line) {
  let delta = 0;
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === quote && line[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
    } else if (char === "(") {
      delta++;
    } else if (char === ")") {
      delta--;
    } else if (char === "/" && line[i + 1] === "/" && !quote) {
      break;
    }
  }
  return delta;
}

function indentation(line) {
  const match = /^\s*/.exec(line);
  return match ? match[0].replace(/\t/g, "  ").length : 0;
}

function docAbove(lines, lineIndex) {
  const docs = [];
  for (let i = lineIndex - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("//")) {
      docs.unshift(trimmed.slice(2).trim());
    } else if (trimmed !== "") {
      break;
    } else if (docs.length > 0) {
      break;
    }
  }
  return docs.length ? docs.join("\n") : undefined;
}

export function indexDocument(text) {
  const lines = text.split(/\r?\n/);
  const variables = [];
  const functions = [];
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const currentDepth = depth;
    depth += parenDelta(line);
    if (depth < 0) depth = 0;

    const trimmed = line.trim();
    if (currentDepth > 0 || trimmed === "" || trimmed.startsWith("//")) continue;

    const variable = VARIABLE_RE.exec(line);
    if (variable && !KEYWORDS.has(variable[2]) && !trimmed.startsWith("@")) {
      variables.push({
        name: variable[2],
        value: variable[4],
        line: i,
        indent: indentation(variable[1]),
        doc: docAbove(lines, i),
      });
      continue;
    }

    const fn = FUNCTION_RE.exec(line);
    if (fn && !KEYWORDS.has(fn[2]) && fn[2] !== "url" && fn[2] !== "calc") {
      const hasInlineBody = Boolean(fn[4]);
      let hasBlock = hasInlineBody;
      if (!hasBlock) {
        const indent = indentation(fn[1]);
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j].trim();
          if (next === "" || next.startsWith("//")) continue;
          hasBlock = indentation(lines[j]) > indent;
          break;
        }
      }
      if (hasBlock) {
        functions.push({
          name: fn[2],
          params: fn[3].trim(),
          line: i,
          indent: indentation(fn[1]),
          doc: docAbove(lines, i),
        });
      }
    }
  }

  return { variables, functions };
}

export function findVariable(index, name) {
  const plain = name.replace(/^\$/, "");
  let found;
  for (const variable of index.variables) {
    if (variable.name.replace(/^\$/, "") === plain) found = variable;
  }
  return found;
}

export function findFunction(index, name) {
  let found;
  for (const fn of index.functions) {
    if (fn.name === name) found = fn;
  }
  return found;
}
