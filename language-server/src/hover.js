import { getAtDirective, getProperty, getPseudo, markdownFor } from "./data/css.js";
import { getBuiltin } from "./data/builtins.js";
import { findFunction, findVariable } from "./symbols.js";

const TOKEN_RE = /[@$:]*[\w-]+/g;

function tokenAt(line, character) {
  TOKEN_RE.lastIndex = 0;
  let match;
  while ((match = TOKEN_RE.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (character >= start && character <= end) {
      return { text: match[0], start, end };
    }
    if (start > character) break;
  }
  return undefined;
}

function codeBlock(language, code) {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

function hoverResult(content, line, token) {
  return {
    contents: { kind: "markdown", value: content },
    range: {
      start: { line, character: token.start },
      end: { line, character: token.end },
    },
  };
}

export function getHover(text, position, index) {
  const lines = text.split(/\r?\n/);
  const line = lines[position.line] ?? "";
  const token = tokenAt(line, position.character);
  if (!token) return null;

  const name = token.text;

  if (name.startsWith("$")) {
    const variable = findVariable(index, name);
    if (variable) {
      const parts = [codeBlock("stylus", `${variable.name} = ${variable.value}`)];
      if (variable.doc) parts.push(variable.doc);
      return hoverResult(parts.join("\n\n"), position.line, token);
    }
  }

  const variable = findVariable(index, name);
  if (variable && !name.startsWith("@")) {
    const declarationLine = lines[variable.line]?.trim() ?? "";
    if (declarationLine.startsWith(name)) {
      const parts = [codeBlock("stylus", `${variable.name} = ${variable.value}`)];
      if (variable.doc) parts.push(variable.doc);
      return hoverResult(parts.join("\n\n"), position.line, token);
    }
  }

  const fn = findFunction(index, name);
  if (fn) {
    const parts = [codeBlock("stylus", `${fn.name}(${fn.params})`)];
    parts.push(fn.doc ?? "User-defined mixin or function.");
    return hoverResult(parts.join("\n\n"), position.line, token);
  }

  const builtin = getBuiltin(name);
  if (builtin) {
    const parts = [codeBlock("stylus", builtin.signature)];
    parts.push(builtin.description ?? "Stylus built-in function.");
    return hoverResult(parts.join("\n\n"), position.line, token);
  }

  if (name.startsWith("@")) {
    const entry = getAtDirective(name);
    const markdown = markdownFor(entry);
    if (markdown) {
      return hoverResult(
        [codeBlock("css", name), markdown].join("\n\n"),
        position.line,
        token,
      );
    }
  }

  if (name.startsWith(":")) {
    const entry = getPseudo(name);
    const markdown = markdownFor(entry);
    if (markdown) {
      return hoverResult(
        [codeBlock("css", name), markdown].join("\n\n"),
        position.line,
        token,
      );
    }
  }

  const property = getProperty(name);
  if (property) {
    const start = line.replace(/^\s*/, "");
    if (start.startsWith(name)) {
      const after = start.slice(name.length);
      if (after === "" || /^[\s:]/.test(after)) {
        const parts = [];
        if (property.syntax) parts.push(codeBlock("css", `${name}: ${property.syntax}`));
        const markdown = markdownFor(property);
        if (markdown) parts.push(markdown);
        return hoverResult(parts.join("\n\n"), position.line, token);
      }
    }
  }

  return null;
}
