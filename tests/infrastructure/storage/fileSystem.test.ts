import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFileSystem } from "../../../src/infrastructure/storage/fileSystem.js";

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
  },
}));

describe("validatePdf", () => {
  let fs: ReturnType<typeof createFileSystem>;

  beforeEach(() => {
    fs = createFileSystem();
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

describe("readJson", () => {
  let fileSystem: ReturnType<typeof createFileSystem>;

  beforeEach(() => {
    fileSystem = createFileSystem();
    vi.resetAllMocks();
  });

  it("returns parsed JSON for valid file", async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"key": "value"}');
    const result = await fileSystem.readJson("/tmp/test.json");
    expect(result).toEqual({ key: "value" });
  });

  it("returns null for missing file (ENOENT)", async () => {
    const err = new Error("ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    vi.mocked(fs.readFile).mockRejectedValue(err);
    const result = await fileSystem.readJson("/tmp/missing.json");
    expect(result).toBeNull();
  });

  it("returns null for corrupted JSON (SyntaxError)", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("{invalid json");
    const result = await fileSystem.readJson("/tmp/corrupt.json");
    expect(result).toBeNull();
  });

  it("returns null for empty file", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("");
    const result = await fileSystem.readJson("/tmp/empty.json");
    expect(result).toBeNull();
  });

  it("returns null for whitespace-only file", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("   \n  ");
    const result = await fileSystem.readJson("/tmp/whitespace.json");
    expect(result).toBeNull();
  });

  it("rethrows non-ENOENT, non-SyntaxError errors", async () => {
    const err = new Error("Permission denied") as NodeJS.ErrnoException;
    err.code = "EACCES";
    vi.mocked(fs.readFile).mockRejectedValue(err);
    await expect(fileSystem.readJson("/tmp/locked.json")).rejects.toThrow("Permission denied");
  });
});
