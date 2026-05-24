import type { DocListItem } from "../models/boib.js";

/**
 * Filters documents by checking if any keyword appears in the document description.
 * Matching is case-insensitive.
 * @param docs - List of documents to filter
 * @param words - Keywords to search for (case-insensitive)
 * @returns Documents whose description contains at least one keyword, or an empty array
 * if no keywords are provided or no documents match
 */
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
