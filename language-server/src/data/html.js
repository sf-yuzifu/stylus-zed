import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let tags = [];
try {
  const htmlData = require("@vscode/web-custom-data/data/browsers.html-data.json");
  tags = htmlData.tags ?? [];
} catch {
  tags = [];
}

export function listTags() {
  return tags;
}
