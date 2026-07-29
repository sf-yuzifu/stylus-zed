import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import stylus from "stylus";

const SOURCE = "Stylus";

function filenameForUri(uri) {
  try {
    const url = new URL(uri);
    if (url.protocol === "file:") {
      return fileURLToPath(url);
    }
  } catch {
    // Untitled and custom-scheme documents still benefit from syntax diagnostics.
  }

  return "untitled.styl";
}

function locationFromError(error, fallbackFilename) {
  const message = String(error?.message || error);
  const formattedLocation = /^(.*):(\d+):(\d+)(?:\r?\n|$)/.exec(message);

  return {
    filename: error?.filename || formattedLocation?.[1] || fallbackFilename,
    lineno: Number(error?.lineno || formattedLocation?.[2]) || 1,
    column: Number(error?.column || formattedLocation?.[3]) || 1,
  };
}

function uriForLocation(location, fallbackUri) {
  if (!location.filename || location.filename === "untitled.styl") {
    return fallbackUri;
  }

  try {
    return pathToFileURL(path.resolve(location.filename)).href;
  } catch {
    return fallbackUri;
  }
}

function diagnosticMessage(error) {
  const message = String(error.message || error).trim();
  const frameEnd = message.indexOf("\n\n");
  if (frameEnd === -1) {
    return message;
  }

  const detail = message.slice(frameEnd + 2).trim();
  return detail || message;
}

function lineAt(text, lineNumber) {
  return text.split(/\r?\n/, lineNumber + 1)[lineNumber] ?? "";
}

function diagnosticRange(location, text, clampToText = true) {
  const lines = text.split(/\r?\n/);
  const requestedLine = Math.max(0, location.lineno - 1);
  const line = clampToText
    ? Math.min(requestedLine, lines.length - 1)
    : requestedLine;
  const lineText = lineAt(text, line);
  const requestedCharacter = Math.max(0, location.column - 1);
  const character = clampToText
    ? Math.min(requestedCharacter, lineText.length)
    : requestedCharacter;

  let endCharacter = character;
  if (character < lineText.length) {
    const codePoint = lineText.codePointAt(character);
    endCharacter += codePoint > 0xffff ? 2 : 1;
  }

  return {
    start: { line, character },
    end: { line, character: endCharacter },
  };
}

export function validateStylus(uri, source) {
  const filename = filenameForUri(uri);

  try {
    stylus(source, {
      cache: false,
      filename,
      paths: filename === "untitled.styl" ? [] : [path.dirname(filename)],
    }).render();
    return { uri, diagnostics: [] };
  } catch (error) {
    const location = locationFromError(error, filename);
    const targetUri = uriForLocation(location, uri);
    const isCurrentDocument = targetUri === uri;
    const diagnosticSource = typeof error?.input === "string" ? error.input : source;
    const code = error?.name && error.name !== "Error" ? error.name : undefined;

    return {
      uri: targetUri,
      diagnostics: [
        {
          range: diagnosticRange(location, diagnosticSource, isCurrentDocument),
          severity: 1,
          source: SOURCE,
          ...(code ? { code } : {}),
          message: diagnosticMessage(error),
        },
      ],
    };
  }
}

export const internals = {
  diagnosticMessage,
  diagnosticRange,
  filenameForUri,
  locationFromError,
};
