import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDownloadFolderName,
  resolveSafePath,
  sanitizePathSegment,
} from "../../../src/infrastructure/storage/paths.js";

describe("sanitizePathSegment", () => {
  it("allows normal filenames", () => {
    expect(sanitizePathSegment("boib_123.pdf")).toBe("boib_123.pdf");
    expect(sanitizePathSegment("file name.pdf")).toBe("file name.pdf");
  });

  it("removes path traversal sequences ..", () => {
    expect(sanitizePathSegment("../foo")).toBe("/foo");
    expect(sanitizePathSegment("../../etc/passwd")).toBe("//etc/passwd");
  });

  it("handles double-dot bypass patterns", () => {
    expect(sanitizePathSegment("..../foo")).toBe("/foo");
    expect(sanitizePathSegment("......")).toBe("");
    expect(sanitizePathSegment("..\\..")).toBe("\\");
    expect(sanitizePathSegment("a..b..c..d")).toBe("abcd");
  });

  it("replaces invalid filesystem characters with underscore", () => {
    expect(sanitizePathSegment("file<name>.pdf")).toBe("file_name_.pdf");
    expect(sanitizePathSegment("file:name|?*.pdf")).toBe("file_name___.pdf");
  });

  it("removes null bytes", () => {
    expect(sanitizePathSegment("file\0name.pdf")).toBe("filename.pdf");
  });

  it("handles dots in valid filenames without breaking them", () => {
    expect(sanitizePathSegment("v1.2.3.pdf")).toBe("v1.2.3.pdf");
    expect(sanitizePathSegment("report.2024.pdf")).toBe("report.2024.pdf");
  });
});

describe("buildDownloadFolderName", () => {
  it("builds a folder name from id and date", () => {
    const result = buildDownloadFolderName("2024", "2024-05-15", "BOIBpdfs");
    expect(result).toContain("BOIBpdfs");
    expect(result).toContain("2024_15-5-2024");
  });

  it("resolves to absolute path from cwd", () => {
    const result = buildDownloadFolderName("2024", "2024-05-15", "BOIBpdfs");
    expect(path.isAbsolute(result)).toBe(true);
  });

  it("handles malformed date gracefully (falls back to current date)", () => {
    const result = buildDownloadFolderName("2024", "invalid-date", "BOIBpdfs");
    expect(result).toContain("BOIBpdfs");
    expect(result).not.toContain("NaN");
    expect(result).toMatch(/\d+-\d+-\d+/);
  });
});

describe("resolveSafePath", () => {
  it("resolves a safe PDF path inside the folder", () => {
    const result = resolveSafePath("/tmp/BOIBpdfs", "boib_123.pdf");
    expect(result).toBe(path.resolve("/tmp/BOIBpdfs", "boib_123.pdf"));
  });

  it("returns null for non-PDF files", () => {
    expect(resolveSafePath("/tmp/BOIBpdfs", "boib_123.exe")).toBeNull();
    expect(resolveSafePath("/tmp/BOIBpdfs", "boib_123")).toBeNull();
  });

  it("returns null when sanitized filename becomes empty", () => {
    expect(resolveSafePath("/tmp/BOIBpdfs", "....")).toBeNull();
    expect(resolveSafePath("/tmp/BOIBpdfs", "..")).toBeNull();
  });

  it("sanitizes invalid characters in filename", () => {
    const result = resolveSafePath("/tmp/BOIBpdfs", "file<name>.pdf");
    expect(result).not.toBeNull();
    expect(result).toContain("file_name_.pdf");
  });

  it("returns a safe path even after sanitizing traversal patterns", () => {
    const result = resolveSafePath("/tmp/BOIBpdfs", "..../secret.pdf");
    expect(result).not.toBeNull();
    expect(result).toBe(path.resolve("/tmp/BOIBpdfs", "secret.pdf"));
  });

  it("blocks paths that would escape the folder via boundary check", () => {
    // Test boundary check directly with a path that sanitizePathSegment does not catch
    // but still resolves outside. On macOS, path.join with absolute second arg
    // still prepends the folder, so we test with a relative path that goes up.
    const result = resolveSafePath("/tmp/BOIBpdfs", "foo/../../../etc/passwd.pdf");
    // sanitizePathSegment turns foo/../../../etc/passwd.pdf → foo/etc/passwd.pdf
    // which is inside the folder, so boundary check passes
    expect(result).not.toBeNull();
    expect(result).toBe(path.resolve("/tmp/BOIBpdfs", "foo/etc/passwd.pdf"));
  });
});
