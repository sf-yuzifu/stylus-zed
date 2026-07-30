import { validateStylus } from "./diagnostics.js";

function measureIndent(line) {
  let width = 0;
  for (const char of line) {
    if (char === " ") width += 1;
    else if (char === "\t") width += 2;
    else break;
  }
  return width;
}

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

function braceDelta(line) {
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
    } else if (char === "{") {
      delta++;
    } else if (char === "}") {
      delta--;
    } else if (char === "/" && line[i + 1] === "/" && !quote) {
      break;
    }
  }
  return delta;
}

function structuralPass(lines, unit) {
  const output = [];
  const depths = [];
  const stack = [];
  let parenDepth = 0;
  let braceDepth = 0;
  let continuationNext = false;
  let statementDepth = 0;
  let previousIndent = 0;
  let previousMeaningful = false;

  for (const raw of lines) {
    const trimmedEnd = raw.replace(/[ \t]+$/g, "");
    const content = trimmedEnd.trim();

    if (content === "") {
      output.push("");
      depths.push(-1);
      continue;
    }

    const indent = measureIndent(trimmedEnd);
    const isContinuation = parenDepth > 0 || continuationNext;
    let depth;

    if (isContinuation) {
      depth = statementDepth + 1;
    } else {
      if (previousMeaningful && indent > previousIndent) {
        stack.push({ indent: previousIndent, depth: statementDepth });
      }
      while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      depth = stack.length;
      statementDepth = depth;
      previousIndent = indent;
      previousMeaningful = true;
    }

    output.push(unit.repeat(depth) + content);
    depths.push(depth);

    const insideBraces = braceDepth > 0;
    parenDepth += parenDelta(trimmedEnd);
    if (parenDepth < 0) parenDepth = 0;
    braceDepth += braceDelta(trimmedEnd);
    if (braceDepth < 0) braceDepth = 0;
    continuationNext =
      parenDepth > 0 ||
      (!insideBraces && content.endsWith(",")) ||
      content.endsWith("\\");
  }

  return { output, depths };
}

export function formatIndentStyle(text, config, { verifyCompiles = true, uri } = {}) {
  const unit = config.tabStopChar ?? "  ";
  const maxBlank = Math.max(0, config.maxConsecutiveBlankLines ?? 1);
  const normalized = text.replace(/\r\n/g, "\n");

  if (verifyCompiles) {
    const original = validateStylus(uri ?? "untitled.styl", normalized);
    if (original.diagnostics.length > 0) {
      return { refused: "document has compiler errors; indent formatting skipped" };
    }
  }

  const lines = normalized.split("\n");
  const first = structuralPass(lines, unit);
  const collapsed = collapseBlankRuns(first.output, maxBlank);
  const formatted = collapsed.join("\n");

  if (!formatted.trim()) {
    return { refused: "indent formatter produced empty output" };
  }

  const second = structuralPass(formatted.split("\n"), unit);
  const secondFormatted = collapseBlankRuns(second.output, maxBlank).join("\n");
  if (secondFormatted !== formatted) {
    return { refused: "indent formatter output is not idempotent" };
  }

  const depthsOf = (outputs, depths) =>
    outputs
      .map((line, i) => (line.trim() === "" ? null : depths[i]))
      .filter((depth) => depth !== null);
  const before = depthsOf(first.output, first.depths);
  const after = depthsOf(second.output, second.depths);
  if (before.length !== after.length || before.some((depth, i) => depth !== after[i])) {
    return { refused: "indent formatter changed the document structure" };
  }

  if (verifyCompiles) {
    const check = validateStylus(uri ?? "untitled.styl", formatted);
    if (check.diagnostics.length > 0) {
      return { refused: "indent formatter output fails to compile" };
    }
  }

  return { formatted };
}

function collapseBlankRuns(lines, maxBlank) {
  const out = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      blankRun++;
      if (blankRun > maxBlank) continue;
      out.push("");
    } else {
      blankRun = 0;
      out.push(line);
    }
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  if (out.length > 0) out.push("");
  return out;
}
