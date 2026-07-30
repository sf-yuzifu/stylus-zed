const TOKEN_RE = /[@$:]*[\w-]+/g;

export function tokenAt(line, character) {
  TOKEN_RE.lastIndex = 0;
  let match;
  while ((match = TOKEN_RE.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (character >= start && character <= end) {
      return { text: match[0], start, end };
    }
    if (start > character) break;
  }
  return undefined;
}

export function makeCommentTracker() {
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

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
