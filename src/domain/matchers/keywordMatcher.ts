import type { DocListItem } from "../models/boib.js";

export function matchKeywords(docs: DocListItem[], words: string[]): DocListItem[] {
  if (words.length === 0) {
    return [];
  }

  const filtered = docs.filter((doc) => {
    return words.some((word) => doc.description.toLowerCase().includes(word.toLowerCase()));
  });

  if (filtered.length === 0) {
    return [];
  }

  return filtered;
}
