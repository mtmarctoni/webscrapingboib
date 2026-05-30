import { describe, expect, it } from "vitest";
import {
  parseBulletin,
  parseDocList,
  parseSectionMenu,
} from "../../../src/domain/parsers/boibParser.js";

describe("parseBulletin", () => {
  it("extracts bulletin metadata from HTML with em dash format", () => {
    const html = `
      <div class="ultimoBoletin">
        <div class="caja whitebg">
          <p><a href="/eboibfront/2024/12345">BOIB núm. 12345 — 15 de gener de 2024</a></p>
        </div>
      </div>
    `;
    const result = parseBulletin(html, "https://www.caib.es/eboibfront/ca");
    expect(result.ultimoBoletin).toContain("BOIB");
    expect(result.idBoib).toBe("2024");
    expect(result.idAnualBoib).toBe("12345");
    expect(result.dateLastBoib).toBe("2024-01-15");
    expect(result.linkUltimoBoletin).toBe("https://www.caib.es/eboibfront/ca/2024/2024");
  });

  it("extracts bulletin metadata with hyphen separator", () => {
    const html = `
      <div class="ultimoBoletin">
        <div class="caja whitebg">
          <p><a href="/eboibfront/2023/99">BOIB núm. 99 - 3 de abril de 2023</a></p>
        </div>
      </div>
    `;
    const result = parseBulletin(html, "https://www.caib.es/eboibfront/ca");
    expect(result.idAnualBoib).toBe("99");
    expect(result.dateLastBoib).toBe("2023-04-03");
  });

  it("extracts bulletin metadata with 'de' format (no em dash)", () => {
    const html = `
      <div class="ultimoBoletin">
        <div class="caja whitebg">
          <p><a href="/eboibfront/2025/6789">BOIB núm. 6789 de 5 de març de 2025</a></p>
        </div>
      </div>
    `;
    const result = parseBulletin(html, "https://www.caib.es/eboibfront/ca");
    expect(result.idAnualBoib).toBe("6789");
    expect(result.dateLastBoib).toBe("2025-03-05");
    expect(result.linkUltimoBoletin).toBe("https://www.caib.es/eboibfront/ca/2025/2025");
  });

  it("extracts bulletin metadata from live BOIB format (slash-separated date)", () => {
    const html = `
      <div class="ultimoBoletin">
        <div class="caja whitebg">
          <p><a href="/eboibfront/2026/12278">El darrer Butlletí Oficial és el 065 <br/> 23 / maig / 2026</a></p>
        </div>
      </div>
    `;
    const result = parseBulletin(html, "https://www.caib.es/eboibfront/ca");
    expect(result.idAnualBoib).toBe("065");
    expect(result.dateLastBoib).toBe("2026-05-23");
    expect(result.idBoib).toBe("2026");
  });

  it("throws when bulletin link is missing", () => {
    const html = `<div class="ultimoBoletin"><div class="caja whitebg"><p><a>Text without href</a></p></div></div>`;
    expect(() => parseBulletin(html, "https://www.caib.es/eboibfront/ca")).toThrow(
      "Could not find bulletin link",
    );
  });

  it("throws when bulletin text does not match expected date format", () => {
    const html = `
      <div class="ultimoBoletin">
        <div class="caja whitebg">
          <p><a href="/eboibfront/2024/12345">Invalid format no numbers here</a></p>
        </div>
      </div>
    `;
    expect(() => parseBulletin(html, "https://www.caib.es/eboibfront/ca")).toThrow(
      "Could not parse bulletin text",
    );
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
    expect(result.sections[0]).toMatchObject({
      id: 0,
      titulo: "section 1",
      link: "https://www.caib.es/section-1/",
    });
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
    const docs = parseDocList(html, "https://www.caib.es");
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
    const docs = parseDocList(html, "https://www.caib.es");
    expect(docs).toEqual([]);
  });

  it("creates separate DocListItem for each PDF link in single resolucions", () => {
    const html = `
      <div class="llistat">
        <ul class="resolucions">
          <p>Multiple resolutions batch</p>
          <p class="registre">REG 456 - 2024</p>
          <a href="/eboibfront/pdf/456">PDF 1</a>
          <a href="/doc/456">HTML 1</a>
          <a href="/eboibfront/pdf/789">PDF 2</a>
          <a href="/doc/789">HTML 2</a>
        </ul>
      </div>
    `;
    const docs = parseDocList(html, "https://www.caib.es");
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({
      id: "456",
      description: "Multiple resolutions batch",
      downloadPdfLink: "https://www.caib.es/eboibfront/pdf/456",
      htmlLink: "https://www.caib.es/doc/456",
    });
    expect(docs[1]).toMatchObject({
      id: "456",
      description: "Multiple resolutions batch",
      downloadPdfLink: "https://www.caib.es/eboibfront/pdf/789",
      htmlLink: "https://www.caib.es/doc/789",
    });
  });
});
