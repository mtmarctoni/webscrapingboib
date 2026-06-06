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

interface SmtpConfig {
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
  notifyNoMatch: boolean;
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

function splitCommaList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export function loadConfig(): AppConfig {
  const requiredVars = ["ZOHO_USER", "ZOHO_PASSWORD", "WORDSTOSEARCH"];
  const missing: string[] = [];

  for (const varName of requiredVars) {
    try {
      requireEnvVar(varName);
    } catch (e: unknown) {
      if (e instanceof EnvValidationError) {
        missing.push(...e.missingVars);
      }
    }
  }

  const emailUser = process.env.ZOHO_USER || "";
  if (emailUser && !validateEmailFormat(emailUser)) {
    console.warn(`Warning: ZOHO_USER does not appear to be a valid email address: ${emailUser}`);
  }

  const recipients = splitCommaList(process.env.RECIPIENTS).filter((r) => {
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
    wordsToSearch: splitCommaList(process.env.WORDSTOSEARCH),
    customers: splitCommaList(process.env.CUSTOMERS),
    sendEmail: process.env.SEND_EMAIL === "true",
    notifyNoMatch: process.env.NOTIFY_NO_MATCH === "true",
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
