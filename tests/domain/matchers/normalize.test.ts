import { describe, expect, it } from "vitest";
import { normalize } from "../../../src/domain/matchers/normalize.js";

describe("normalize", () => {
  it("lowercases the string", () => {
    expect(normalize("HELLO")).toBe("hello");
  });

  it("strips accents from Catalan vowels", () => {
    expect(normalize("subvenció")).toBe("subvencio");
    expect(normalize("intel·ligència")).toBe("intel·ligencia");
    expect(normalize("automatització")).toBe("automatitzacio");
  });

  it("strips accents from Spanish vowels", () => {
    expect(normalize("licitación")).toBe("licitacion");
    expect(normalize("público")).toBe("publico");
    expect(normalize("órdenes")).toBe("ordenes");
  });

  it("handles mixed accents and case", () => {
    expect(normalize("Inteligència Artificial")).toBe("inteligencia artificial");
  });

  it("preserves non-accented characters", () => {
    expect(normalize("hello world 123")).toBe("hello world 123");
  });

  it("handles empty string", () => {
    expect(normalize("")).toBe("");
  });

  it("handles string with no changes needed", () => {
    expect(normalize("alpha")).toBe("alpha");
  });
});
