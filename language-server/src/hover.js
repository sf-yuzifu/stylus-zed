import { getAtDirective, getProperty, getPseudo, markdownFor } from "./data/css.js";
import { getBuiltin } from "./data/builtins.js";
import { resolveAt } from "./navigation.js";
import { tokenAt } from "./text.js";

function basename(uri) {
  try {
    return decodeURIComponent(new URL(uri).pathname.split("/").pop());
  } catch {
    return uri;
  }
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
  const resolved = resolveAt(index, name, position.line);

  if (resolved?.type === "variable") {
    const variable = resolved.symbol;
    const declaration =
      variable.kind === "param"
        ? variable.name
        : `${variable.name} = ${variable.value}`;
    const parts = [codeBlock("stylus", declaration)];
    if (variable.doc) parts.push(variable.doc);
    if (variable.kind === "param") parts.push("Function parameter.");
    if (variable.uri) parts.push(`Imported from \`${basename(variable.uri)}\`.`);
    return hoverResult(parts.join("\n\n"), position.line, token);
  }

  if (resolved?.type === "function") {
    const fn = resolved.symbol;
    const parts = [codeBlock("stylus", `${fn.name}(${fn.params})`)];
    parts.push(fn.doc ?? "User-defined mixin or function.");
    if (fn.uri) parts.push(`Imported from \`${basename(fn.uri)}\`.`);
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
