import supremacy from "stylus-supremacy";

const SCIENTIFIC_NOTATION_RE = /\d\.?\d*[eE][+-]?\d/;

export const DEFAULT_FORMAT_CONFIG = {
  engine: "supremacy",
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

export function formatDocument(text, config = DEFAULT_FORMAT_CONFIG) {
  const merged = { ...DEFAULT_FORMAT_CONFIG, ...config, options: config.options ?? {} };

  if (merged.engine === "whitespace") {
    const formatted = formatWhitespace(text, merged);
    if (formatted === text) return { edits: [] };
    return { edits: fullDocumentEdit(text, formatted) };
  }

  return formatSupremacy(text, merged);
}
