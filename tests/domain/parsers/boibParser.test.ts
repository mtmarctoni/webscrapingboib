import { describe, it, expect } from "vitest";
import { parseBulletin, parseSectionMenu, parseDocList } from "../../../src/domain/parsers/boibParser.js";

describe("parseBulletin", () => {
  it("extracts bulletin metadata from HTML", () => {
    const html = `
      <div class="ultimoBoletin">
        <div class="caja whitebg">
          <p><a href="/eboibfront/2024/12345">BOIB núm. 12345 — 15 de gener de 2024</a></p>
        </div>
      </div>
    `;
    const result = parseBulletin(html, "https://www.caib.es/eboibfront/ca");
    expect(result.ultimoBoletin).toContain("BOIB");
    // idBoib comes from reversed URL segments: /eboibfront/2024/12345 → reverse()[1] = "2024"
    expect(result.idBoib).toBe("2024");
    // idAnualBoib comes from words[6] of the title text
    expect(result.idAnualBoib).toBe("gener");
    // linkUltimoBoletin = baseUrl + ano + idBoib = .../2024/2024
    expect(result.linkUltimoBoletin).toBe("https://www.caib.es/eboibfront/ca/2024/2024");
  });

  it("throws when bulletin link is missing", () => {
    const html = `<div class="ultimoBoletin"><div class="caja whitebg"><p><a>Text without href</a></p></div></div>`;
    expect(() => parseBulletin(html, "https://www.caib.es/eboibfront/ca")).toThrow("Could not find bulletin link");
  });
});

describe("parseSectionMenu", () => {
  it("extracts section links and extraordinary flag", () => {
    const html = `
      <a class="fijo"><p>Some text</p><p>Extraordinari</p></a>
      <div class="primerosHijos">
        <li><a href="/section-1/">Section 1</a></li>
        <li><a href="/section-2/">Section 2</a></li>
      </div>
    `;
    const result = parseSectionMenu(html, "https://www.caib.es");
    expect(result.isExtraordinary).toBe(true);
    expect(result.sections).toHaveLength(2);
    // Trailing slash gives reverse()[1] = "section-1"
    expect(result.sections[0]).toMatchObject({ id: 0, titulo: "section 1", link: "https://www.caib.es/section-1/" });
  });

  it("returns empty sections when no menu found", () => {
    const html = `<a class="fijo"><p>Ordinari</p></a>`;
    const result = parseSectionMenu(html, "https://www.caib.es");
    expect(result.isExtraordinary).toBe(false);
    expect(result.sections).toEqual([]);
  });
});

describe("parseDocList", () => {
  it("extracts PDF and HTML links from doc list HTML", () => {
    const html = `
      <div class="llistat">
        <ul class="resolucions">
          <p>Resolution about Alpha funding</p>
          <p class="registre">REG 123 - 2024</p>
          <a href="/eboibfront/pdf/123">PDF</a>
          <a href="/doc/123">HTML</a>
        </ul>
      </div>
    `;
    const docs = parseDocList(html, 0, "https://www.caib.es", "https://www.caib.es");
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      id: "123",
      description: "Resolution about Alpha funding",
      downloadPdfLink: "https://www.caib.es/eboibfront/pdf/123",
      htmlLink: "https://www.caib.es/doc/123",
    });
  });

  it("returns empty array when no llistat element found", () => {
    const html = `<div>No docs here</div>`;
    const docs = parseDocList(html, 0, "https://www.caib.es", "https://www.caib.es");
    expect(docs).toEqual([]);
  });
});
