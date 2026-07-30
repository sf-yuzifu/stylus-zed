import { resolveFunction, resolveVariable } from "./symbols.js";
import { escapeRegExp, makeCommentTracker, tokenAt } from "./text.js";

function declarationOnLine(index, name, lineNumber) {
  const plain = name.replace(/^\$/, "");
  for (const variable of index.variables) {
    if (
      !variable.imported &&
      variable.line === lineNumber &&
      variable.name.replace(/^\$/, "") === plain
    ) {
      return { symbol: variable, type: "variable" };
    }
  }
  for (const fn of index.functions) {
    if (!fn.imported && fn.line === lineNumber && fn.name === plain) {
      return { symbol: fn, type: "function" };
    }
  }
  return undefined;
}

export function resolveAt(index, name, lineNumber) {
  const plain = name.replace(/^\$/, "");

  const onDecl = declarationOnLine(index, name, lineNumber);
  if (onDecl) return onDecl;

  const variable = resolveVariable(index, name, lineNumber);
  if (variable) return { symbol: variable, type: "variable" };

  const fn = resolveFunction(index, plain, lineNumber);
  if (fn) return { symbol: fn, type: "function" };

  return undefined;
}

function nameRangeInText(fileText, symbol) {
  const lineText = fileText.split(/\r?\n/)[symbol.line] ?? "";
  const plain = symbol.name.replace(/^\$/, "");
  let start = lineText.indexOf(symbol.name);
  let length = symbol.name.length;
  if (start === -1) {
    start = lineText.indexOf(plain);
    length = plain.length;
  }
  if (start === -1) start = 0;
  return {
    start: { line: symbol.line, character: start },
    end: { line: symbol.line, character: start + length },
  };
}

export function getDefinition(text, position, index, uri, resolveText) {
  const lines = text.split(/\r?\n/);
  const token = tokenAt(lines[position.line] ?? "", position.character);
  if (!token || token.text.startsWith("@") || token.text.startsWith(":")) {
    return null;
  }

  const resolved = resolveAt(index, token.text, position.line);
  if (!resolved) return null;

  const targetUri = resolved.symbol.uri ?? uri;
  const targetText = targetUri === uri ? text : resolveText?.(targetUri);
  if (targetText == null) return null;

  return {
    uri: targetUri,
    range: nameRangeInText(targetText, resolved.symbol),
  };
}

function occurrenceRegex(name) {
  const plain = escapeRegExp(name.replace(/^\$/, ""));
  return new RegExp(`(?<![\\w$-])\\$?${plain}(?![\\w-])`, "g");
}

function isFirstToken(line, start) {
  return line.slice(0, start).trim() === "";
}

function followedByAssignment(line, end) {
  return /^\s*(=|\?=|:=)/.test(line.slice(end));
}

export function targetAt(text, position, index) {
  const lines = text.split(/\r?\n/);
  const token = tokenAt(lines[position.line] ?? "", position.character);
  if (!token) return undefined;
  const resolved = resolveAt(index, token.text, position.line);
  return resolved ? { token, resolved } : undefined;
}

function sameSymbol(a, aFallbackUri, b, bFallbackUri) {
  return (
    a.name === b.name &&
    a.line === b.line &&
    (a.uri ?? aFallbackUri) === (b.uri ?? bFallbackUri)
  );
}

export function scanOccurrences(text, index, target, type, uri, includeDeclaration, resolveText, includeOriginDeclaration = false) {
  const lines = text.split(/\r?\n/);
  const targetUri = target.uri ?? uri;
  const regex = occurrenceRegex(target.name);
  const trackComments = makeCommentTracker();
  const references = [];
  const targetRange = targetUri === uri ? nameRangeInText(text, target) : null;

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];
    const commentMask = trackComments(line);

    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (commentMask[start]) continue;

      const isDeclaration =
        targetRange !== null &&
        lineNumber === target.line &&
        start <= targetRange.start.character &&
        end >= targetRange.end.character;

      if (!isDeclaration) {
        if (type === "variable" && !match[0].startsWith("$")) {
          if (isFirstToken(line, start) && !followedByAssignment(line, end)) {
            continue;
          }
        }
        if (type === "function" && line[end] !== "(") {
          continue;
        }

        const scope = resolveAt(index, match[0], lineNumber);
        if (!scope || !sameSymbol(scope.symbol, uri, target, uri)) {
          continue;
        }
      } else if (!includeDeclaration) {
        continue;
      }

      references.push({
        uri,
        range: {
          start: { line: lineNumber, character: start },
          end: { line: lineNumber, character: end },
        },
        text: match[0],
      });
    }
  }

  if (targetUri !== uri && includeDeclaration && includeOriginDeclaration) {
    const originText = resolveText?.(targetUri);
    if (originText != null) {
      references.unshift({
        uri: targetUri,
        range: nameRangeInText(originText, target),
        text: target.name,
        declaration: true,
      });
    }
  }

  return references;
}

export function getReferences(text, position, index, uri, includeDeclaration = true, resolveText) {
  const found = targetAt(text, position, index);
  if (!found) return [];
  return scanOccurrences(
    text,
    index,
    found.resolved.symbol,
    found.resolved.type,
    uri,
    includeDeclaration,
    resolveText,
    true,
  );
}

export function getPrepareRename(text, position, index) {
  const lines = text.split(/\r?\n/);
  const token = tokenAt(lines[position.line] ?? "", position.character);
  if (!token) return null;

  const resolved = resolveAt(index, token.text, position.line);
  if (!resolved) return null;

  return {
    range: {
      start: { line: position.line, character: token.start },
      end: { line: position.line, character: token.end },
    },
    placeholder: token.text.replace(/^\$/, ""),
  };
}

export function getRenameEdits(text, position, index, uri, newName, resolveText) {
  const plain = newName.replace(/^\$/, "");
  const references = getReferences(text, position, index, uri, true, resolveText);

  const changes = {};
  for (const reference of references) {
    const edit = {
      range: reference.range,
      newText: `${reference.text.startsWith("$") ? "$" : ""}${plain}`,
    };
    (changes[reference.uri] ??= []).push(edit);
  }
  return { changes };
}
