import { describe, expect, it } from "vitest";

function splitCommaList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

describe("splitCommaList", () => {
  it("returns empty array for undefined", () => {
    expect(splitCommaList(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(splitCommaList("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(splitCommaList("   ")).toEqual([]);
  });

  it("splits a single value", () => {
    expect(splitCommaList("urban")).toEqual(["urban"]);
  });

  it("splits comma-separated values", () => {
    expect(splitCommaList("urban, licitacion, contrato")).toEqual([
      "urban",
      "licitacion",
      "contrato",
    ]);
  });

  it("trims whitespace around values", () => {
    expect(splitCommaList("  urban  ,  licitacion  ,  contrato  ")).toEqual([
      "urban",
      "licitacion",
      "contrato",
    ]);
  });

  it("filters out empty items from trailing commas", () => {
    expect(splitCommaList("urban,licitacion,")).toEqual(["urban", "licitacion"]);
  });

  it("filters out empty items from leading commas", () => {
    expect(splitCommaList(",urban,licitacion")).toEqual(["urban", "licitacion"]);
  });

  it("filters out empty items from double commas", () => {
    expect(splitCommaList("urban,,licitacion")).toEqual(["urban", "licitacion"]);
  });

  it("handles email addresses", () => {
    expect(splitCommaList("alice@example.com, bob@example.com")).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  it("handles a single comma (produces empty array)", () => {
    expect(splitCommaList(",")).toEqual([]);
  });

  it("handles commas with only whitespace between", () => {
    expect(splitCommaList("  ,  ,  ")).toEqual([]);
  });
});
