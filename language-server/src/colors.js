import { getProperty } from "./data/css.js";
import { formatHex, formatHsl, formatRgb, isNamedColor, parseColor } from "./data/colors.js";

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}\b|[0-9a-fA-F]{6}\b|[0-9a-fA-F]{8}\b)/g;
const COLOR_FN_RE = /\b(?:rgba?|hsla?)\([^)]*\)/gi;
const WORD_RE = /[a-zA-Z][\w-]*/g;
const VARIABLE_RE = /\$?[\w-]+/g;

function makeCommentTracker() {
  let inBlock = false;
  return (line) => {
    const mask = new Array(line.length).fill(false);
    for (let i = 0; i < line.length; i++) {
      if (!inBlock && line[i] === "/" && line[i + 1] === "/") {
        mask.fill(true, i);
        break;
      }
      if (!inBlock && line[i] === "/" && line[i + 1] === "*") {
        inBlock = true;
        mask[i] = mask[i + 1] = true;
        i++;
        continue;
      }
      if (inBlock && line[i] === "*" && line[i + 1] === "/") {
        mask[i] = mask[i + 1] = true;
        i++;
        inBlock = false;
        continue;
      }
      mask[i] = inBlock;
    }
    return mask;
  };
}

function isValuePosition(line, index) {
  const before = line.slice(0, index);
  const start = before.replace(/^\s*/, "");

  if (/[=:(,]\s*$/.test(before)) return true;

  const wordMatch = /^(-?[a-zA-Z][\w-]*|--[\w-]+)/.exec(start);
  if (!wordMatch) return false;
  const word = wordMatch[1];
  if (getProperty(word) === undefined && !word.startsWith("--")) return false;
  return /^[\s:]/.test(start.slice(word.length));
}

function colorAt(color, line, start, end) {
  return {
    range: {
      start: { line, character: start },
      end: { line, character: end },
    },
    color,
  };
}

export function getDocumentColors(text, index) {
  const lines = text.split(/\r?\n/);
  const colors = [];
  const trackComments = makeCommentTracker();

  const colorVariables = new Map();
  for (const variable of index.variables) {
    const color = parseColor(variable.value);
    if (color) {
      colorVariables.set(variable.name.replace(/^\$/, ""), color);
    }
  }

  const declarationLines = new Set(index.variables.map((v) => v.line));

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];
    const commentMask = trackComments(line);

    HEX_RE.lastIndex = 0;
    let match;
    while ((match = HEX_RE.exec(line)) !== null) {
      const start = match.index;
      if (commentMask[start] || line.slice(0, start).trim() === "") continue;
      const color = parseColor(match[0]);
      if (color) {
        colors.push(colorAt(color, lineNumber, start, start + match[0].length));
      }
    }

    COLOR_FN_RE.lastIndex = 0;
    while ((match = COLOR_FN_RE.exec(line)) !== null) {
      const start = match.index;
      if (commentMask[start]) continue;
      const color = parseColor(match[0]);
      if (color) {
        colors.push(colorAt(color, lineNumber, start, start + match[0].length));
      }
    }

    WORD_RE.lastIndex = 0;
    while ((match = WORD_RE.exec(line)) !== null) {
      const start = match.index;
      const word = match[0];
      if (!isNamedColor(word) || commentMask[start]) continue;
      if (!isValuePosition(line, start)) continue;
      colors.push(
        colorAt(parseColor(word), lineNumber, start, start + word.length),
      );
    }

    if (colorVariables.size > 0 && !declarationLines.has(lineNumber)) {
      VARIABLE_RE.lastIndex = 0;
      while ((match = VARIABLE_RE.exec(line)) !== null) {
        const start = match.index;
        if (commentMask[start]) continue;
        const color = colorVariables.get(match[0].replace(/^\$/, ""));
        if (!color) continue;
        colors.push(
          colorAt(color, lineNumber, start, start + match[0].length),
        );
      }
    }
  }

  return colors;
}

export function getColorPresentations(color, range) {
  return [formatHex, formatRgb, formatHsl].map((formatter) => {
    const label = formatter(color);
    return {
      label,
      textEdit: { range, newText: label },
    };
  });
}
