import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { importSpecs, resolveImports } from "./workspace.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", ".hg", ".svn", "dist", "out"]);
const MAX_FILES = 1000;
const MAX_DEPTH = 12;

export function listStylusFiles(rootUri) {
  let rootPath;
  try {
    rootPath = fileURLToPath(rootUri);
  } catch {
    return [];
  }

  const files = [];

  function walk(dir, depth) {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          walk(full, depth + 1);
        }
      } else if (entry.isFile() && entry.name.endsWith(".styl")) {
        try {
          if (statSync(full).isFile()) files.push(pathToFileURL(full).href);
        } catch {
          // skip unreadable entries
        }
      }
    }
  }

  walk(rootPath, 0);
  return files;
}

export function directImportUris(uri, text) {
  const uris = [];
  for (const spec of importSpecs(text)) {
    for (const resolved of resolveImports(spec, uri)) {
      uris.push(pathToFileURL(resolved).href);
    }
  }
  return uris;
}

export function reverseReachable(targetUri, candidateUris, resolveText) {
  const reverse = new Map();

  for (const uri of candidateUris) {
    const text = resolveText(uri);
    if (text == null) continue;
    for (const dependency of directImportUris(uri, text)) {
      let upstream = reverse.get(dependency);
      if (!upstream) {
        upstream = new Set();
        reverse.set(dependency, upstream);
      }
      upstream.add(uri);
    }
  }

  const reachable = new Set([targetUri]);
  const queue = [targetUri];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const upstream of reverse.get(current) ?? []) {
      if (!reachable.has(upstream)) {
        reachable.add(upstream);
        queue.push(upstream);
      }
    }
  }
  return reachable;
}
