import dotenv from "dotenv";
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
} from "./constants.js";

dotenv.config();

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  recipients: string[];
}

export interface AppConfig {
  baseUrl: string;
  allowedDomain: string;
  wordsToSearch: string[];
  customers: string[];
  sendEmail: boolean;
  stateFile: string;
  pdfDownloadFolder: string;
  httpTimeout: number;
  maxContentLength: number;
  maxPdfSize: number;
  smtp: SmtpConfig;
}

class EnvValidationError extends Error {
  constructor(public readonly missingVars: string[]) {
    const message = `Missing required environment variables:\n${missingVars.map((v) => `  - ${v}`).join("\n")}`;
    super(message);
    this.name = "EnvValidationError";
  }
}

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new EnvValidationError([name]);
  }
  return value.trim();
}

function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function collectEnvVars(prefix: string, max: number): string[] {
  const result: string[] = [];
  for (let i = 1; i <= max; i++) {
    const value = process.env[`${prefix}_${i}`];
    if (value && value.trim() !== "") {
      result.push(value.trim());
    }
  }
  return result;
}

export function loadConfig(): AppConfig {
  const requiredVars = ["ZOHO_USER", "ZOHO_PASSWORD", "WORDTOSEARCH_1"];
  const missing: string[] = [];

  for (const varName of requiredVars) {
    try {
      requireEnvVar(varName);
    } catch (e) {
      if (e instanceof EnvValidationError) {
        missing.push(...e.missingVars);
      }
    }
  }

  const emailUser = process.env.ZOHO_USER || "";
  if (emailUser && !validateEmailFormat(emailUser)) {
    console.warn(`Warning: ZOHO_USER does not appear to be a valid email address: ${emailUser}`);
  }

  const recipients = collectEnvVars("RECIPIENT", 3).filter((r) => {
    if (!validateEmailFormat(r)) {
      console.warn(`Warning: Invalid email format for recipient: ${r}`);
      return false;
    }
    return true;
  });

  if (missing.length > 0) {
    throw new EnvValidationError(missing);
  }

  return {
    baseUrl: BASE_URL,
    allowedDomain: ALLOWED_DOMAIN,
    wordsToSearch: collectEnvVars("WORDTOSEARCH", 9),
    customers: collectEnvVars("CUSTOMER", 7),
    sendEmail: process.env.SEND_EMAIL !== "false",
    stateFile: DEFAULT_STATE_FILE,
    pdfDownloadFolder: PDF_DOWNLOAD_FOLDER,
    httpTimeout: HTTP_TIMEOUT,
    maxContentLength: MAX_CONTENT_LENGTH,
    maxPdfSize: MAX_PDF_SIZE,
    smtp: {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      user: emailUser,
      pass: process.env.ZOHO_PASSWORD || "",
      recipients,
    },
  };
}
