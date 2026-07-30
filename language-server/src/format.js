import supremacy from "stylus-supremacy";

import { formatIndentStyle } from "./formatIndent.js";

const SCIENTIFIC_NOTATION_RE = /\d\.?\d*[eE][+-]?\d/;

export const DEFAULT_FORMAT_CONFIG = {
  engine: "indent",
  options: {},
  tabStopChar: "  ",
  maxConsecutiveBlankLines: 1,
};

function fullDocumentEdit(text, newText) {
  const lines = text.split(/\r?\n/);
  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: lines.length - 1, character: lines[lines.length - 1].length },
      },
      newText,
    },
  ];
}

function formatWhitespace(text, config) {
  const tab = config.tabStopChar ?? "  ";
  const maxBlank = Math.max(0, config.maxConsecutiveBlankLines ?? 1);

  const out = [];
  let blankRun = 0;

  for (const line of text.split(/\r?\n/)) {
    const withoutTrailing = line.replace(/[ \t]+$/g, "");
    const withIndent = withoutTrailing.replace(/^\t+/, (tabs) => tab.repeat(tabs.length));

    if (withIndent.trim() === "") {
      blankRun++;
      if (blankRun > maxBlank) continue;
      out.push("");
    } else {
      blankRun = 0;
      out.push(withIndent);
    }
  }

  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n") + "\n";
}

function formatSupremacy(text, config) {
  if (SCIENTIFIC_NOTATION_RE.test(text)) {
    return {
      refused:
        "stylus-supremacy corrupts scientific notation (e.g. 1e5px); formatting skipped for safety",
    };
  }

  let formatted;
  try {
    formatted = supremacy.format(text, config.options ?? {});
  } catch (error) {
    return {
      refused: `stylus-supremacy could not format this document: ${String(error.message ?? error).split("\n")[0]}`,
    };
  }

  if (!formatted || !formatted.trim()) {
    return { refused: "stylus-supremacy returned empty output; formatting skipped" };
  }
  if (formatted.includes("\r")) {
    return {
      refused:
        "stylus-supremacy injected carriage returns into selector groups; formatting skipped for safety",
    };
  }

  let secondPass;
  try {
    secondPass = supremacy.format(formatted, config.options ?? {});
  } catch {
    return { refused: "stylus-supremacy is unstable on this document; formatting skipped" };
  }
  if (secondPass !== formatted) {
    return {
      refused:
        "stylus-supremacy output is not idempotent on this document (known upstream limitation, e.g. @document); formatting skipped for safety",
    };
  }

  if (formatted === text) return { edits: [] };
  return { edits: fullDocumentEdit(text, formatted) };
}

export function formatDocument(text, config = DEFAULT_FORMAT_CONFIG, context = {}) {
  const merged = { ...DEFAULT_FORMAT_CONFIG, ...config, options: config.options ?? {} };

  if (merged.engine === "whitespace") {
    const formatted = formatWhitespace(text, merged);
    if (formatted === text) return { edits: [] };
    return { edits: fullDocumentEdit(text, formatted) };
  }

  if (merged.engine === "indent") {
    const result = formatIndentStyle(text, merged, {
      verifyCompiles: true,
      uri: context.uri,
    });
    if (result.refused) return { refused: result.refused };
    if (result.formatted === text) return { edits: [] };
    return { edits: fullDocumentEdit(text, result.formatted) };
  }

  return formatSupremacy(text, merged);
}

function baseIndentOf(lines) {
  let base = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const width = /^[ \t]*/.exec(line)[0].replace(/\t/g, "  ").length;
    if (width < base) base = width;
  }
  return base === Infinity ? 0 : base;
}

export function formatDocumentRange(text, range, config = DEFAULT_FORMAT_CONFIG, context = {}) {
  const merged = { ...DEFAULT_FORMAT_CONFIG, ...config, options: config.options ?? {} };
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  const startLine = range.start.line;
  let endLine = range.end.line;
  if (range.end.character === 0 && endLine > startLine) endLine -= 1;
  if (startLine >= lines.length || endLine < startLine) return { edits: [] };
  endLine = Math.min(endLine, lines.length - 1);

  const fragment = lines.slice(startLine, endLine + 1);
  if (fragment.every((line) => line.trim() === "")) return { edits: [] };

  const base = baseIndentOf(fragment);
  const dedented = fragment
    .map((line) => {
      let width = 0;
      let rest = line;
      while (width < base && (rest.startsWith(" ") || rest.startsWith("\t"))) {
        width += rest.startsWith("\t") ? 2 : 1;
        rest = rest.slice(1);
      }
      return rest;
    })
    .join("\n");

  let formatted;
  if (merged.engine === "whitespace") {
    formatted = formatWhitespace(dedented, merged);
  } else if (merged.engine === "indent") {
    const result = formatIndentStyle(dedented, merged, { verifyCompiles: false });
    if (result.refused) return { refused: result.refused };
    formatted = result.formatted;
  } else {
    try {
      formatted = supremacy.format(dedented, merged.options ?? {});
    } catch (error) {
      return {
        refused: `stylus-supremacy could not format the selection: ${String(error.message ?? error).split("\n")[0]}`,
      };
    }
    if (!formatted || formatted.includes("\r")) {
      return { refused: "stylus-supremacy could not format the selection safely" };
    }
  }

  const unit = merged.tabStopChar ?? "  ";
  const unitWidth = Math.max(1, unit.replace(/\t/g, "  ").length);
  const prefix = unit.repeat(Math.round(base / unitWidth));
  const reindented = formatted
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : prefix + line))
    .join("\n");

  const original = fragment.join("\n");
  if (reindented === original) return { edits: [] };

  return {
    edits: [
      {
        range: {
          start: { line: startLine, character: 0 },
          end: { line: endLine, character: lines[endLine].length },
        },
        newText: reindented,
      },
    ],
  };
}
