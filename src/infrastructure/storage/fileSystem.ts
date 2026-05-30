import fs from "node:fs/promises";
import type { AppConfig } from "../../config/environment.js";

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

export interface FileSystem {
  readJson<T>(filePath: string): Promise<T | null>;
  writeJson<T>(filePath: string, data: T): Promise<void>;
  mkdir(dirPath: string): Promise<void>;
  readdir(dirPath: string): Promise<string[]>;
  writeFile(filePath: string, data: Buffer): Promise<void>;
  validatePdf(data: Buffer): boolean;
}

export function createFileSystem(_config: AppConfig): FileSystem {
  return {
    async readJson<T>(filePath: string): Promise<T | null> {
      try {
        const content = await fs.readFile(filePath, "utf8");
        if (!content.trim()) {
          return null;
        }
        return JSON.parse(content) as T;
      } catch (err: unknown) {
        if (err instanceof SyntaxError) {
          return null;
        }
        if (
          err instanceof Error &&
          "code" in err &&
          (err as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return null;
        }
        throw err;
      }
    },

    async writeJson<T>(filePath: string, data: T): Promise<void> {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
    },

    async mkdir(dirPath: string): Promise<void> {
      await fs.mkdir(dirPath, { recursive: true });
    },

    async readdir(dirPath: string): Promise<string[]> {
      return fs.readdir(dirPath);
    },

    async writeFile(filePath: string, data: Buffer): Promise<void> {
      await fs.writeFile(filePath, data);
    },

    validatePdf(data: Buffer): boolean {
      if (data.length < 8) return false;
      if (!data.subarray(0, 4).equals(PDF_MAGIC)) return false;
      // Verify full header: %PDF-X.Y
      const newlineIdx = data.indexOf(0x0a);
      const lineEnd = newlineIdx > 0 ? newlineIdx : data.length;
      const header = data.subarray(0, lineEnd).toString("ascii").replace(/\r$/, "");
      return /^%PDF-\d+\.\d+$/.test(header);
    },
  };
}
