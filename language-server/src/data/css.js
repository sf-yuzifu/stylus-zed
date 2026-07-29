import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cssData = require("@vscode/web-custom-data/data/browsers.css-data.json");

const properties = new Map();
for (const property of cssData.properties) {
  properties.set(property.name, property);
}

const pseudoClasses = new Map();
for (const entry of cssData.pseudoClasses) {
  pseudoClasses.set(entry.name, entry);
}

const pseudoElements = new Map();
for (const entry of cssData.pseudoElements) {
  pseudoElements.set(entry.name, entry);
}

const STYLUS_AT_RULES = [
  {
    name: "@block",
    description: "Assigns a block of Stylus to a variable for later interpolation.",
  },
  {
    name: "@extend",
    description: "Stylus @extend: inherits the styles of another selector.",
  },
  {
    name: "@require",
    description: "Like @import, but marks the file as required for the compilation.",
  },
  {
    name: "@css",
    description: "Embeds literal CSS that is passed through unmodified.",
  },
  {
    name: "@document",
    description: "Conditional rules applied only to matching document URLs.",
  },
  {
    name: "@viewport",
    description: "Sets viewport properties for adaptive layouts.",
  },
];

const atDirectives = new Map();
for (const entry of cssData.atDirectives) {
  atDirectives.set(entry.name, entry);
}
for (const entry of STYLUS_AT_RULES) {
  if (!atDirectives.has(entry.name)) atDirectives.set(entry.name, entry);
}

function byName(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export function listProperties() {
  return cssData.properties;
}

export function getProperty(name) {
  return properties.get(name);
}

export function listAtDirectives() {
  return [...atDirectives.values()].sort(byName);
}

export function getAtDirective(name) {
  return atDirectives.get(name);
}

export function listPseudoClasses() {
  return cssData.pseudoClasses;
}

export function listPseudoElements() {
  return cssData.pseudoElements;
}

export function getPseudo(name) {
  return pseudoClasses.get(name) ?? pseudoElements.get(name);
}

export function valuesForProperty(name) {
  return properties.get(name)?.values ?? [];
}

export function markdownFor(entry) {
  if (!entry) return undefined;
  const parts = [];
  if (entry.description) parts.push(String(entry.description));
  const reference = entry.references?.find((ref) => ref.url);
  if (reference) parts.push(`[${reference.name}](${reference.url})`);
  return parts.join("\n\n");
}
