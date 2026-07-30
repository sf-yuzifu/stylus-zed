import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { globSync } from "glob";

import { indexDocument } from "./symbols.js";

const IMPORT_RE = /^\s*@(?:import|require)\s+(['"])([^'"]+)\1/gm;
const GLOB_CHARS_RE = /[*?[\]{}]/;
const MAX_DEPTH = 8;
const MAX_GLOB_MATCHES = 100;
const MAX_NODE_MODULES_ASCENT = 10;

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

function isFile(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function dirOf(fromUri) {
  try {
    return path.dirname(fileURLToPath(fromUri));
  } catch {
    return null;
  }
}

function relativeCandidates(spec, fromUri) {
  const dir = dirOf(fromUri);
  if (!dir) return [];

  if (GLOB_CHARS_RE.test(spec)) {
    try {
      return globSync(spec, {
        cwd: dir,
        posix: true,
        windowsPathsNoEscape: true,
        nodir: true,
        absolute: true,
      })
        .slice(0, MAX_GLOB_MATCHES)
        .sort();
    } catch {
      return [];
    }
  }

  return [
    path.join(dir, spec),
    path.join(dir, `${spec}.styl`),
    path.join(dir, spec, "index.styl"),
    path.join(dir, spec, `${path.basename(spec)}.styl`),
  ].filter(isFile);
}

function packageMainCandidates(nmDir, spec) {
  const packageJson = path.join(nmDir, spec, "package.json");
  if (!isFile(packageJson)) return null;

  try {
    const main = JSON.parse(readFileSync(packageJson, "utf8")).main;
    if (typeof main !== "string" || main === "") return null;
    return [
      path.join(nmDir, spec, main),
      path.join(nmDir, spec, `${main}.styl`),
      path.join(nmDir, spec, main, "index.styl"),
    ].find(isFile) ?? null;
  } catch {
    return null;
  }
}

function nodeModulesCandidates(spec, fromUri) {
  if (GLOB_CHARS_RE.test(spec)) return [];

  let dir = dirOf(fromUri);
  if (!dir) return [];

  for (let i = 0; i < MAX_NODE_MODULES_ASCENT; i++) {
    const nmDir = path.join(dir, "node_modules");
    const found =
      [
        path.join(nmDir, `${spec}.styl`),
        path.join(nmDir, spec, "index.styl"),
        path.join(nmDir, spec, `${path.basename(spec)}.styl`),
      ].find(isFile) ?? packageMainCandidates(nmDir, spec);
    if (found) return [found];

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [];
}

export function resolveImports(spec, fromUri) {
  const relative = relativeCandidates(spec, fromUri);
  if (relative.length > 0) return relative;
  return nodeModulesCandidates(spec, fromUri);
}

export function resolveImport(spec, fromUri) {
  return resolveImports(spec, fromUri)[0] ?? null;
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
      for (const resolved of resolveImports(spec, currentUri)) {
        if (seen.has(resolved)) continue;
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
