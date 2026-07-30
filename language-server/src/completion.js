import {
  getProperty,
  listAtDirectives,
  listProperties,
  listPseudoClasses,
  listPseudoElements,
  markdownFor,
  valuesForProperty,
} from "./data/css.js";
import { listBuiltins } from "./data/builtins.js";
import { listTags } from "./data/html.js";

const Kind = {
  Function: 3,
  Variable: 6,
  Class: 7,
  Property: 10,
  Value: 12,
  Keyword: 14,
  EnumMember: 20,
};

const Snippet = 2;

const CONTROL_KEYWORDS = [
  "if",
  "else",
  "unless",
  "for",
  "in",
  "return",
  "not",
  "and",
  "or",
  "is",
  "is defined",
  "is a",
];

function markdown(value) {
  return value ? { kind: "markdown", value } : undefined;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  });
}

function variableItems(index, line) {
  const visible = index.variables
    .filter(
      (variable) =>
        variable.imported ||
        variable.line === line ||
        (variable.line < line && line <= variable.endLine),
    )
    .sort((a, b) => b.indent - a.indent || b.line - a.line);

  const items = [];
  const seen = new Set();
  for (const variable of visible) {
    const plain = variable.name.replace(/^\$/, "");
    if (seen.has(plain)) continue;
    seen.add(plain);
    const origin = variable.uri ? ` — ${basename(variable.uri)}` : "";
    items.push({
      label: variable.name,
      kind: Kind.Variable,
      detail: `${
        variable.value.length > 60
          ? `${variable.value.slice(0, 57)}…`
          : variable.value
      }${origin}`,
      documentation: markdown(variable.doc),
    });
  }
  return items;
}

function functionItems(index) {
  const items = [];
  const seen = new Set();
  for (const fn of index.functions) {
    if (seen.has(fn.name)) continue;
    seen.add(fn.name);
    const origin = fn.uri ? ` — ${basename(fn.uri)}` : "";
    items.push({
      label: fn.name,
      kind: Kind.Function,
      detail: `${fn.name}(${fn.params})${origin}`,
      documentation: markdown(fn.doc),
      ...(fn.params
        ? { insertText: `${fn.name}($0)`, insertTextFormat: Snippet }
        : {}),
    });
  }
  return items;
}

function basename(uri) {
  try {
    return decodeURIComponent(new URL(uri).pathname.split("/").pop());
  } catch {
    return uri;
  }
}

function builtinItems() {
  return listBuiltins().map((builtin) => ({
    label: builtin.name,
    kind: Kind.Function,
    detail: builtin.signature,
    documentation: markdown(builtin.description),
    insertText: `${builtin.name}($0)`,
    insertTextFormat: Snippet,
  }));
}

function propertyItems() {
  return listProperties().map((property) => ({
    label: property.name,
    kind: Kind.Property,
    detail: property.syntax,
    documentation: markdown(markdownFor(property)),
  }));
}

function valueItems(propertyName) {
  return valuesForProperty(propertyName).map((value) => ({
    label: value.name,
    kind: Kind.Value,
    documentation: markdown(markdownFor(value)),
  }));
}

function atRuleItems() {
  return listAtDirectives().map((entry) => ({
    label: entry.name,
    kind: Kind.Keyword,
    documentation: markdown(markdownFor(entry)),
  }));
}

function pseudoItems() {
  return [
    ...listPseudoClasses(),
    ...listPseudoElements(),
  ].map((entry) => ({
    label: entry.name,
    kind: Kind.EnumMember,
    documentation: markdown(markdownFor(entry)),
  }));
}

function keywordItems() {
  return CONTROL_KEYWORDS.map((keyword) => ({
    label: keyword,
    kind: Kind.Keyword,
  }));
}

function tagItems() {
  return listTags().map((tag) => ({
    label: tag.name,
    kind: Kind.Class,
    documentation: markdown(markdownFor(tag)),
  }));
}

export function getCompletions(text, position, index) {
  const line = text.split(/\r?\n/)[position.line] ?? "";
  const before = line.slice(0, position.character);

  if (/@[\w-]*$/.test(before)) {
    return dedupe(atRuleItems());
  }

  if (/\$[\w-]*$/.test(before)) {
    return dedupe(variableItems(index, position.line));
  }

  const start = before.replace(/^\s*/, "");
  const wordMatch = /^(-?[a-zA-Z][\w-]*|--[\w-]+)/.exec(start);
  const word = wordMatch?.[1];
  const afterWord = word ? start.slice(word.length) : undefined;
  const isPropertyWord =
    word !== undefined &&
    (getProperty(word) !== undefined || word.startsWith("--"));
  const inValue =
    isPropertyWord && afterWord !== undefined && /^[\s:]/.test(afterWord);

  if (inValue || /[\w$-]+\([^()]*$/.test(before)) {
    return dedupe([
      ...(inValue ? valueItems(word) : []),
      ...variableItems(index, position.line),
      ...builtinItems(),
      ...functionItems(index),
    ]);
  }

  if (/::?[\w-]*$/.test(before)) {
    return dedupe(pseudoItems());
  }

  if (/^[\s.#&>+~*/[\]-]*[\w$-]*$/.test(before)) {
    const items = [
      ...propertyItems(),
      ...functionItems(index),
      ...atRuleItems(),
      ...keywordItems(),
    ];
    if (/^\s*[\w-]*$/.test(before)) {
      items.push(...tagItems());
    }
    return dedupe(items);
  }

  return [];
}
