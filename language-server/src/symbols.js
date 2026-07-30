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

const VARIABLE_RE = /^(\s*)(\$?[\w$-]+)\s*(=|\?=|:=)(?!=)\s*(.*?)\s*(?:\/\/.*)?$/;
const FUNCTION_RE = /^(\s*)([a-zA-Z_-][\w$-]*)\(([^)]*)\)\s*(\{.*\})?\s*$/;
const FOR_RE = /^(\s*)for\s+([\w$-]+)(?:\s*,\s*([\w$-]+))?\s+in\s+/;

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

function isTrivial(line) {
  const trimmed = line.trim();
  return (
    trimmed === "" ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*")
  );
}

function blockEnd(lines, startLine, indent, inclusive) {
  let lastMeaningful = startLine;
  for (let i = startLine + 1; i < lines.length; i++) {
    if (isTrivial(lines[i])) continue;
    const lineIndent = indentation(lines[i]);
    if (inclusive ? lineIndent < indent : lineIndent <= indent) {
      return lastMeaningful;
    }
    lastMeaningful = i;
  }
  return lastMeaningful;
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

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      current += char;
      if (char === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") depth++;
    if (char === ")" || char === "]" || char === "}") depth--;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function paramVariables(fn, bodyEnd) {
  const variables = [];
  for (const param of splitTopLevel(fn.params, ",")) {
    const match = /^\s*([\w$-]+?)\s*(\.\.\.)?\s*(=.*)?$/.exec(param);
    if (!match) continue;
    variables.push({
      name: match[1],
      value: match[3] ? match[3].slice(1).trim() : "parameter",
      line: fn.line,
      indent: fn.indent + 1,
      endLine: bodyEnd,
      kind: "param",
      doc: undefined,
    });
  }
  return variables;
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
      const indent = indentation(variable[1]);
      variables.push({
        name: variable[2],
        value: variable[4] || "@block",
        line: i,
        indent,
        endLine: blockEnd(lines, i, indent, true),
        kind: "variable",
        doc: docAbove(lines, i),
      });
      continue;
    }

    const forLoop = FOR_RE.exec(line);
    if (forLoop) {
      const indent = indentation(forLoop[1]);
      const bodyEnd = blockEnd(lines, i, indent, false);
      for (const name of [forLoop[2], forLoop[3]]) {
        if (!name) continue;
        variables.push({
          name,
          value: "loop variable",
          line: i,
          indent: indent + 1,
          endLine: bodyEnd,
          kind: "param",
          doc: undefined,
        });
      }
      continue;
    }

    const fn = FUNCTION_RE.exec(line);
    if (fn && !KEYWORDS.has(fn[2]) && fn[2] !== "url" && fn[2] !== "calc") {
      const indent = indentation(fn[1]);
      const hasInlineBody = Boolean(fn[4]);
      let hasBlock = hasInlineBody;
      if (!hasBlock) {
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j].trim();
          if (next === "" || next.startsWith("//")) continue;
          hasBlock = indentation(lines[j]) > indent;
          break;
        }
      }
      if (hasBlock) {
        const bodyEnd = blockEnd(lines, i, indent, false);
        const def = {
          name: fn[2],
          params: fn[3].trim(),
          line: i,
          indent,
          endLine: blockEnd(lines, i, indent, true),
          bodyEnd,
          kind: "function",
          doc: docAbove(lines, i),
        };
        functions.push(def);
        variables.push(...paramVariables(def, bodyEnd));
      }
    }
  }

  return { variables, functions, lineCount: lines.length };
}

function visibleAt(symbol, line) {
  return symbol.line < line && line <= symbol.endLine;
}

function resolveIn(symbols, name, line) {
  const plain = name.replace(/^\$/, "");
  let best;
  for (const symbol of symbols) {
    if (symbol.name.replace(/^\$/, "") !== plain) continue;
    if (!symbol.imported && !visibleAt(symbol, line)) continue;
    if (
      !best ||
      symbol.indent > best.indent ||
      (symbol.indent === best.indent && symbol.line > best.line)
    ) {
      best = symbol;
    }
  }
  return best;
}

export function resolveVariable(index, name, line) {
  return resolveIn(index.variables, name, line);
}

export function resolveFunction(index, name, line) {
  return resolveIn(index.functions, name, line);
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
