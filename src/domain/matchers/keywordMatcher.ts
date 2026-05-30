import type { DocListItem } from "../models/boib.js";

export type Keyword =
  | { type: "or"; value: string }
  | { type: "and"; value: string }
  | { type: "phrase"; value: string };

function _valueForDisplay(k: Keyword): string {
  if (k.type === "or") return k.value;
  if (k.type === "and") return `+${k.value}`;
  return `phrase:${k.value}`;
}

/**
 * Parses raw keyword strings into typed Keyword objects.
 *
 * Prefix rules:
 * - `+` prefix → AND keyword (doc must contain ALL AND keywords)
 * - `phrase:` prefix → exact phrase match
 * - No prefix → OR keyword (doc matches if ANY OR keyword is found)
 *
 * Empty values after stripping prefix are discarded.
 */
export function parseKeywords(words: string[]): Keyword[] {
  const result: Keyword[] = [];
  for (const word of words) {
    if (word.startsWith("phrase:")) {
      const value = word.slice(7);
      if (value) result.push({ type: "phrase", value });
    } else if (word.startsWith("+") && word.length > 1) {
      result.push({ type: "and", value: word.slice(1) });
    } else if (word && word !== "+") {
      result.push({ type: "or", value: word });
    }
  }
  return result;
}

/**
 * Filters documents by checking typed keywords against the document description.
 * Matching is case-insensitive.
 *
 * A document passes if:
 * - At least one OR keyword matches, OR
 * - ALL AND keywords match, OR
 * - At least one Phrase keyword matches (exact phrase)
 *
 * If multiple groups are present, any matching group is sufficient.
 */
export function matchKeywords(docs: DocListItem[], keywords: Keyword[]): DocListItem[] {
  if (keywords.length === 0) {
    return [];
  }

  const orKeywords = keywords.filter((k) => k.type === "or");
  const andKeywords = keywords.filter((k) => k.type === "and");
  const phraseKeywords = keywords.filter((k) => k.type === "phrase");

  const filtered = docs.filter((doc) => {
    const description = doc.description.toLowerCase();

    const orMatch =
      orKeywords.length > 0 && orKeywords.some((k) => description.includes(k.value.toLowerCase()));

    const andMatch =
      andKeywords.length > 0 &&
      andKeywords.every((k) => description.includes(k.value.toLowerCase()));

    const phraseMatch =
      phraseKeywords.length > 0 &&
      phraseKeywords.some((k) => description.includes(k.value.toLowerCase()));

    return orMatch || andMatch || phraseMatch;
  });

  if (filtered.length === 0) {
    return [];
  }

  return filtered;
}
