import { getBuiltin } from "./data/builtins.js";
import { findFunction } from "./symbols.js";

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

function findCallContext(text, position) {
  const lines = text.split(/\r?\n/);
  const stack = [];
  let quote = null;
  let inBlockComment = false;

  for (let lineNumber = 0; lineNumber <= position.line; lineNumber++) {
    const line = lines[lineNumber];
    const endChar = lineNumber === position.line ? position.character : line.length;

    for (let i = 0; i < endChar; i++) {
      const char = line[i];

      if (inBlockComment) {
        if (char === "*" && line[i + 1] === "/") {
          inBlockComment = false;
          i++;
        }
        continue;
      }
      if (quote) {
        if (char === quote && line[i - 1] !== "\\") quote = null;
        continue;
      }
      if (char === "/" && line[i + 1] === "/") break;
      if (char === "/" && line[i + 1] === "*") {
        inBlockComment = true;
        i++;
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        continue;
      }
      if (char === "(") {
        const nameMatch = /([\w$-]+)$/.exec(line.slice(0, i));
        stack.push({ name: nameMatch?.[1], line: lineNumber, character: i });
      } else if (char === ")") {
        stack.pop();
      }
    }
  }

  const call = stack[stack.length - 1];
  if (!call || !call.name) return null;
  return call;
}

function countActiveParameter(text, call, position) {
  const lines = text.split(/\r?\n/);
  let depth = 0;
  let quote = null;
  let count = 0;

  for (let lineNumber = call.line; lineNumber <= position.line; lineNumber++) {
    const line = lines[lineNumber];
    const startChar = lineNumber === call.line ? call.character + 1 : 0;
    const endChar = lineNumber === position.line ? position.character : line.length;

    for (let i = startChar; i < endChar; i++) {
      const char = line[i];
      if (quote) {
        if (char === quote && line[i - 1] !== "\\") quote = null;
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        continue;
      }
      if (char === "(" || char === "[" || char === "{") depth++;
      else if (char === ")" || char === "]" || char === "}") depth--;
      else if (char === "," && depth === 0) count++;
    }
  }

  return count;
}

function signatureFrom(name, paramsSource, documentation) {
  const params = paramsSource.trim();
  const label = `${name}(${params})`;
  const parameters = params
    ? splitTopLevel(params, ",").map((param) => ({
        label: param.trim(),
      }))
    : [];

  return {
    label,
    documentation: documentation
      ? { kind: "markdown", value: documentation }
      : undefined,
    parameters,
  };
}

export function getSignatureHelp(text, position, index) {
  const call = findCallContext(text, position);
  if (!call) return null;

  let signature;
  const userFunction = findFunction(index, call.name);
  if (userFunction) {
    signature = signatureFrom(
      userFunction.name,
      userFunction.params,
      userFunction.doc ?? "User-defined mixin or function.",
    );
  } else {
    const builtin = getBuiltin(call.name);
    if (!builtin) return null;
    const paramsSource = builtin.signature.slice(
      builtin.signature.indexOf("(") + 1,
      builtin.signature.lastIndexOf(")"),
    );
    signature = signatureFrom(
      builtin.name,
      paramsSource,
      builtin.description ?? "Stylus built-in function.",
    );
  }

  return {
    signatures: [signature],
    activeSignature: 0,
    activeParameter: countActiveParameter(text, call, position),
  };
}

export const internals = { findCallContext, countActiveParameter, splitTopLevel };
