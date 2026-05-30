import { describe, expect, it } from "vitest";
import { matchKeywords, parseKeywords } from "../../../src/domain/matchers/keywordMatcher.js";
import type { DocListItem } from "../../../src/domain/models/boib.js";

describe("parseKeywords", () => {
  it("parses bare words as OR keywords", () => {
    const result = parseKeywords(["alpha", "beta"]);
    expect(result).toEqual([
      { type: "or", value: "alpha" },
      { type: "or", value: "beta" },
    ]);
  });

  it("parses + prefix as AND keywords", () => {
    const result = parseKeywords(["+IA", "+subvenció"]);
    expect(result).toEqual([
      { type: "and", value: "IA" },
      { type: "and", value: "subvenció" },
    ]);
  });

  it("parses phrase: prefix as phrase keywords", () => {
    const result = parseKeywords(["phrase:inteligencia artificial"]);
    expect(result).toEqual([{ type: "phrase", value: "inteligencia artificial" }]);
  });

  it("handles mixed keyword types", () => {
    const result = parseKeywords(["phrase:inteligencia artificial", "+IA", "automatització"]);
    expect(result).toEqual([
      { type: "phrase", value: "inteligencia artificial" },
      { type: "and", value: "IA" },
      { type: "or", value: "automatització" },
    ]);
  });

  it("discards empty values after stripping prefix", () => {
    const result = parseKeywords(["phrase:", "+"]);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    const result = parseKeywords([]);
    expect(result).toEqual([]);
  });
});

describe("matchKeywords", () => {
  const docs: DocListItem[] = [
    { id: "1", htmlLink: "", description: "Project Alpha funding approved", downloadPdfLink: "" },
    { id: "2", htmlLink: "", description: "Beta testing results", downloadPdfLink: "" },
    { id: "3", htmlLink: "", description: "Alpha phase complete", downloadPdfLink: "" },
    { id: "4", htmlLink: "", description: "General meeting minutes", downloadPdfLink: "" },
    {
      id: "5",
      htmlLink: "",
      description: "inteligencia artificial per a projectes",
      downloadPdfLink: "",
    },
    {
      id: "6",
      htmlLink: "",
      description: "Subvenció per IA i automatització",
      downloadPdfLink: "",
    },
    {
      id: "7",
      htmlLink: "",
      description: "Subvenció per a projectes digitals",
      downloadPdfLink: "",
    },
    {
      id: "8",
      htmlLink: "",
      description: "Ajudes per a la transformació digital",
      downloadPdfLink: "",
    },
  ];

  it("returns docs matching any OR keyword (case-insensitive)", () => {
    const result = matchKeywords(docs, parseKeywords(["alpha"]));
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toEqual(["1", "3"]);
  });

  it("matches multiple OR keywords", () => {
    const result = matchKeywords(docs, parseKeywords(["alpha", "beta"]));
    expect(result).toHaveLength(3);
  });

  it("returns empty array when no matches", () => {
    const result = matchKeywords(docs, parseKeywords(["gamma"]));
    expect(result).toEqual([]);
  });

  it("returns empty array when keywords array is empty", () => {
    const result = matchKeywords(docs, []);
    expect(result).toEqual([]);
  });

  it("AND requires all + keywords to be present", () => {
    const result = matchKeywords(docs, parseKeywords(["+IA", "+subvenció"]));
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("6");
  });

  it("AND fails when one keyword is missing", () => {
    const result = matchKeywords(docs, parseKeywords(["+alpha", "+beta"]));
    expect(result).toEqual([]);
  });

  it("phrase matches exact string (case-insensitive)", () => {
    const result = matchKeywords(docs, parseKeywords(["phrase:inteligencia artificial"]));
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("5");
  });

  it("phrase does not match partial words", () => {
    const result = matchKeywords(docs, parseKeywords(["phrase:alpha funding"]));
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("mixed: OR, AND, and phrase in combination", () => {
    const result = matchKeywords(
      docs,
      parseKeywords(["phrase:inteligencia artificial", "+automatització", "beta"]),
    );
    // phrase matches doc 5, AND matches doc 6, OR matches docs 2
    // all should be in results
    expect(result).toHaveLength(3);
    const ids = result.map((d) => d.id).sort();
    expect(ids).toEqual(["2", "5", "6"]);
  });

  it("single AND keyword behaves like OR", () => {
    const result = matchKeywords(docs, parseKeywords(["+alpha"]));
    expect(result).toHaveLength(2);
  });

  it("matches accented description with unaccented keyword (accent normalization)", () => {
    const result = matchKeywords(docs, parseKeywords(["subvencio"]));
    expect(result).toHaveLength(2);
  });

  it("matches unaccented description with accented keyword", () => {
    const result = matchKeywords(docs, parseKeywords(["transformació"]));
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("8");
  });

  it("matches mixed accents", () => {
    const result = matchKeywords(docs, parseKeywords(["Subvenció", "ajudes"]));
    expect(result).toHaveLength(3);
  });
});
