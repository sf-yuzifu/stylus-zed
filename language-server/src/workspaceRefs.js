import { scanOccurrences, targetAt } from "./navigation.js";

export function getWorkspaceReferences({
  text,
  position,
  index,
  uri,
  includeDeclaration = true,
  resolveText,
  listCandidateUris,
  indexForFile,
}) {
  const found = targetAt(text, position, index);
  if (!found) return [];

  const target = found.resolved.symbol;
  const targetUri = target.uri ?? uri;

  const visibleUris = new Set([uri]);
  for (const candidateUri of listCandidateUris()) {
    if (candidateUri === targetUri) {
      visibleUris.add(candidateUri);
      continue;
    }
    const entry = indexForFile(candidateUri);
    if (entry?.importClosure?.has(targetUri)) {
      visibleUris.add(candidateUri);
    }
  }

  const references = [];
  for (const fileUri of visibleUris) {
    const fileText = fileUri === uri ? text : resolveText?.(fileUri);
    if (fileText == null) continue;

    const fileIndex = fileUri === uri ? index : indexForFile(fileUri)?.index;
    if (!fileIndex) continue;

    references.push(
      ...scanOccurrences(
        fileText,
        fileIndex,
        target,
        found.resolved.type,
        fileUri,
        includeDeclaration,
        resolveText,
      ),
    );
  }

  return references;
}

export function getWorkspaceRenameEdits(params) {
  const plain = params.newName.replace(/^\$/, "");
  const references = getWorkspaceReferences({ ...params, includeDeclaration: true });

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

function nameRange(lines, lineNumber, name) {
  const lineText = lines[lineNumber] ?? "";
  const plain = name.replace(/^\$/, "");
  let start = lineText.indexOf(name);
  let length = name.length;
  if (start === -1) {
    start = lineText.indexOf(plain);
    length = plain.length;
  }
  if (start === -1) start = 0;
  return {
    start: { line: lineNumber, character: start },
    end: { line: lineNumber, character: start + length },
  };
}

export function getDocumentSymbols(text, index) {
  const lines = text.split("\n");
  const symbols = [];

  for (const variable of index.variables) {
    if (variable.imported || variable.kind === "param") continue;
    symbols.push({
      name: variable.name,
      kind: 13,
      detail: variable.value,
      range: {
        start: { line: variable.line, character: 0 },
        end: { line: variable.line, character: (lines[variable.line] ?? "").length },
      },
      selectionRange: nameRange(lines, variable.line, variable.name),
    });
  }

  for (const fn of index.functions) {
    if (fn.imported) continue;
    symbols.push({
      name: fn.name,
      kind: 12,
      detail: `${fn.name}(${fn.params})`,
      range: {
        start: { line: fn.line, character: 0 },
        end: { line: fn.bodyEnd, character: (lines[fn.bodyEnd] ?? "").length },
      },
      selectionRange: nameRange(lines, fn.line, fn.name),
    });
  }

  return symbols.sort((a, b) => a.range.start.line - b.range.start.line);
}
