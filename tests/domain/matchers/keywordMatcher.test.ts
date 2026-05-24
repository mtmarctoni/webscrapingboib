import { describe, expect, it } from "vitest";
import { matchKeywords } from "../../../src/domain/matchers/keywordMatcher.js";
import type { DocListItem } from "../../../src/domain/models/boib.js";

describe("matchKeywords", () => {
  const docs: DocListItem[] = [
    { id: "1", htmlLink: "", description: "Project Alpha funding approved", downloadPdfLink: "" },
    { id: "2", htmlLink: "", description: "Beta testing results", downloadPdfLink: "" },
    { id: "3", htmlLink: "", description: "Alpha phase complete", downloadPdfLink: "" },
    { id: "4", htmlLink: "", description: "General meeting minutes", downloadPdfLink: "" },
  ];

  it("returns docs matching any keyword (case-insensitive)", () => {
    const result = matchKeywords(docs, ["alpha"]);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toEqual(["1", "3"]);
  });

  it("matches multiple keywords", () => {
    const result = matchKeywords(docs, ["alpha", "beta"]);
    expect(result).toHaveLength(3);
  });

  it("returns empty array when no matches", () => {
    const result = matchKeywords(docs, ["gamma"]);
    expect(result).toEqual([]);
  });

  it("returns empty array when keywords array is empty", () => {
    const result = matchKeywords(docs, []);
    expect(result).toEqual([]);
  });
});
