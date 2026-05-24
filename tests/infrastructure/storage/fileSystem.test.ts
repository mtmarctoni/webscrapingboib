import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../../../src/config/environment.js";
import { createFileSystem } from "../../../src/infrastructure/storage/fileSystem.js";

function makeConfig(): AppConfig {
  return {} as AppConfig;
}

describe("validatePdf", () => {
  let fs: ReturnType<typeof createFileSystem>;

  beforeEach(() => {
    fs = createFileSystem(makeConfig());
  });

  it("accepts valid PDF with version 1.7", () => {
    const buf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(100)]);
    expect(fs.validatePdf(buf)).toBe(true);
  });

  it("accepts valid PDF with version 2.0", () => {
    const buf = Buffer.concat([Buffer.from("%PDF-2.0\n"), Buffer.alloc(100)]);
    expect(fs.validatePdf(buf)).toBe(true);
  });

  it("rejects data shorter than 8 bytes", () => {
    expect(fs.validatePdf(Buffer.from("%PDF-1"))).toBe(false);
  });

  it("rejects data without PDF magic bytes", () => {
    expect(fs.validatePdf(Buffer.from("GIF89a\n"))).toBe(false);
  });

  it("rejects PDF magic without valid version", () => {
    const buf = Buffer.concat([Buffer.from("%PDF\n"), Buffer.alloc(100)]);
    expect(fs.validatePdf(buf)).toBe(false);
  });

  it("rejects invalid version format", () => {
    const buf = Buffer.concat([Buffer.from("%PDF-abc\n"), Buffer.alloc(100)]);
    expect(fs.validatePdf(buf)).toBe(false);
  });

  it("rejects PDF with garbage before magic bytes", () => {
    const buf = Buffer.concat([Buffer.from("XXX%PDF-1.7\n"), Buffer.alloc(100)]);
    expect(fs.validatePdf(buf)).toBe(false);
  });

  it("accepts PDF with CRLF line ending", () => {
    const buf = Buffer.concat([Buffer.from("%PDF-1.7\r\n"), Buffer.alloc(100)]);
    expect(fs.validatePdf(buf)).toBe(true);
  });

  it("rejects PDF with binary garbage before newline", () => {
    const buf = Buffer.concat([
      Buffer.from("%PDF-1.7"),
      Buffer.from([0x00, 0x0a]),
      Buffer.alloc(100),
    ]);
    expect(fs.validatePdf(buf)).toBe(false);
  });

  it("rejects empty buffer", () => {
    expect(fs.validatePdf(Buffer.alloc(0))).toBe(false);
  });
});
