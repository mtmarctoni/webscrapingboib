import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWED_DOMAIN,
  BASE_URL,
  DEFAULT_STATE_FILE,
  HTTP_TIMEOUT,
  MAX_CONTENT_LENGTH,
  MAX_PDF_SIZE,
  PDF_DOWNLOAD_FOLDER,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
} from "../../src/config/constants.js";
import { loadConfig } from "../../src/config/environment.js";

function splitCommaList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

const ENV_KEYS = [
  "ZOHO_USER",
  "ZOHO_PASSWORD",
  "WORDSTOSEARCH",
  "SEND_EMAIL",
  "NOTIFY_NO_MATCH",
  "RECIPIENTS",
  "CUSTOMERS",
] as const;

let envBackup: Partial<Record<string, string | undefined>> = {};

beforeEach(() => {
  envBackup = {};
  for (const key of ENV_KEYS) {
    envBackup[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const backed = envBackup[key];
    if (backed === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = backed;
    }
  }
});

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

describe("loadConfig", () => {
  it("returns valid config with all required vars set", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "urban, medi ambient";

    const config = loadConfig();

    expect(config.baseUrl).toBe(BASE_URL);
    expect(config.allowedDomain).toBe(ALLOWED_DOMAIN);
    expect(config.wordsToSearch).toEqual(["urban", "medi ambient"]);
    expect(config.customers).toEqual([]);
    expect(config.sendEmail).toBe(false);
    expect(config.notifyNoMatch).toBe(false);
    expect(config.stateFile).toBe(DEFAULT_STATE_FILE);
    expect(config.pdfDownloadFolder).toBe(PDF_DOWNLOAD_FOLDER);
    expect(config.httpTimeout).toBe(HTTP_TIMEOUT);
    expect(config.maxContentLength).toBe(MAX_CONTENT_LENGTH);
    expect(config.maxPdfSize).toBe(MAX_PDF_SIZE);
    expect(config.smtp).toEqual({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      user: "admin@example.com",
      pass: "s3cret!",
      recipients: [],
    });
  });

  it("throws when ZOHO_USER is missing", () => {
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    expect(() => loadConfig()).toThrow("ZOHO_USER");
  });

  it("throws when ZOHO_USER is whitespace only", () => {
    process.env.ZOHO_USER = "   ";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    expect(() => loadConfig()).toThrow("ZOHO_USER");
  });

  it("throws when ZOHO_PASSWORD is missing", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.WORDSTOSEARCH = "kw";
    expect(() => loadConfig()).toThrow("ZOHO_PASSWORD");
  });

  it("throws when ZOHO_PASSWORD is whitespace only", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "";
    process.env.WORDSTOSEARCH = "kw";
    expect(() => loadConfig()).toThrow("ZOHO_PASSWORD");
  });

  it("throws when WORDSTOSEARCH is missing", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    expect(() => loadConfig()).toThrow("WORDSTOSEARCH");
  });

  it("throws when all required vars are missing", () => {
    expect(() => loadConfig()).toThrow("Missing required environment variables");
    expect(() => loadConfig()).toThrow(
      /ZOHO_USER.*ZOHO_PASSWORD.*WORDSTOSEARCH|ZOHO_USER.*\n.*ZOHO_PASSWORD.*\n.*WORDSTOSEARCH/,
    );
  });

  it("parses RECIPIENTS into smtp.recipients", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    process.env.RECIPIENTS = "alice@example.com, bob@example.com";

    const config = loadConfig();
    expect(config.smtp.recipients).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("filters invalid emails from RECIPIENTS with warning", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    process.env.RECIPIENTS = "alice@example.com, not-an-email";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = loadConfig();
    expect(config.smtp.recipients).toEqual(["alice@example.com"]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not-an-email"));
    warnSpy.mockRestore();
  });

  it("parses CUSTOMERS when provided", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    process.env.CUSTOMERS = "Acme Corp, Beta SL, Gamma SA";

    const config = loadConfig();
    expect(config.customers).toEqual(["Acme Corp", "Beta SL", "Gamma SA"]);
  });

  it("sets sendEmail to true when SEND_EMAIL=true", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    process.env.SEND_EMAIL = "true";

    const config = loadConfig();
    expect(config.sendEmail).toBe(true);
  });

  it("sets sendEmail to false when SEND_EMAIL is not 'true'", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    process.env.SEND_EMAIL = "false";

    const config = loadConfig();
    expect(config.sendEmail).toBe(false);
  });

  it("sets notifyNoMatch to true when NOTIFY_NO_MATCH=true", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    process.env.NOTIFY_NO_MATCH = "true";

    const config = loadConfig();
    expect(config.notifyNoMatch).toBe(true);
  });

  it("sets notifyNoMatch to false when NOTIFY_NO_MATCH is not 'true'", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    process.env.NOTIFY_NO_MATCH = "yes";

    const config = loadConfig();
    expect(config.notifyNoMatch).toBe(false);
  });

  it("warns when ZOHO_USER is not a valid email", () => {
    process.env.ZOHO_USER = "not-an-email";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = loadConfig();
    expect(config.smtp.user).toBe("not-an-email");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not-an-email"));
    warnSpy.mockRestore();
  });

  it("handles empty RECIPIENTS gracefully", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";
    process.env.RECIPIENTS = "";

    const config = loadConfig();
    expect(config.smtp.recipients).toEqual([]);
  });

  it("handles empty CUSTOMERS gracefully", () => {
    process.env.ZOHO_USER = "admin@example.com";
    process.env.ZOHO_PASSWORD = "s3cret!";
    process.env.WORDSTOSEARCH = "kw";

    const config = loadConfig();
    expect(config.customers).toEqual([]);
  });
});
