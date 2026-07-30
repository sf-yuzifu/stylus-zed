import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { indexDocument } from "./symbols.js";

const IMPORT_RE = /^\s*@(?:import|require)\s+(['"])([^'"]+)\1/gm;
const MAX_DEPTH = 8;

export function importSpecs(text) {
  const specs = [];
  IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = IMPORT_RE.exec(text)) !== null) {
    const spec = match[2];
    if (
      spec.startsWith("url(") ||
      spec.includes("://") ||
      spec.endsWith(".css")
    ) {
      continue;
    }
    specs.push(spec);
  }
  return specs;
}

export function resolveImport(spec, fromUri) {
  let fromPath;
  try {
    fromPath = fileURLToPath(fromUri);
  } catch {
    return null;
  }

  const dir = path.dirname(fromPath);
  const candidates = [
    path.join(dir, spec),
    path.join(dir, `${spec}.styl`),
    path.join(dir, spec, "index.styl"),
  ];

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function mtimeOf(filePath) {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

export function collectWorkspaceIndex(uri, text) {
  const index = indexDocument(text);
  const files = [{ uri, mtime: mtimeOf(safeFilePath(uri)) }];
  const importClosure = new Set();
  const seen = new Set([safeFilePath(uri)]);

  function visit(currentUri, currentText, depth) {
    if (depth >= MAX_DEPTH) return;

    for (const spec of importSpecs(currentText)) {
      const resolved = resolveImport(spec, currentUri);
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);

      let fileText;
      try {
        fileText = readFileSync(resolved, "utf8");
      } catch {
        continue;
      }

      const fileUri = pathToFileURL(resolved).href;
      files.push({ uri: fileUri, mtime: mtimeOf(resolved) });
      importClosure.add(fileUri);

      const fileIndex = indexDocument(fileText);
      for (const variable of fileIndex.variables) {
        if (variable.indent === 0 && variable.kind === "variable") {
          index.variables.push({ ...variable, uri: fileUri, imported: true });
        }
      }
      for (const fn of fileIndex.functions) {
        if (fn.indent === 0) {
          index.functions.push({ ...fn, uri: fileUri, imported: true });
        }
      }

      visit(fileUri, fileText, depth + 1);
    }
  }

  visit(uri, text, 0);
  return { index, files, importClosure };
}

function safeFilePath(uri) {
  try {
    return fileURLToPath(uri);
  } catch {
    return "";
  }
}
