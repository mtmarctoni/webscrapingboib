import dotenv from "dotenv";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
dotenv.config();

import type { BoibInfo } from "../types/boibInfo.js";

const ALLOWED_DOMAIN = "https://www.caib.es";

class EnvValidationError extends Error {
  constructor(public readonly missingVars: string[]) {
    const message = `Missing required environment variables:\n${missingVars.map(v => `  - ${v}`).join("\n")}`;
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

export function validateEnvironment(): void {
  const requiredVars = [
    "ZOHO_USER",
    "ZOHO_PASSWORD",
    "WORDTOSEARCH_1",
  ];
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

  const recipients: string[] = [
    process.env.RECIPIENT1 || "",
    process.env.RECIPIENT2 || "",
    process.env.RECIPIENT3 || "",
  ].filter(Boolean);

  for (const recipient of recipients) {
    if (!validateEmailFormat(recipient)) {
      console.warn(`Warning: Invalid email format for recipient: ${recipient}`);
    }
  }

  if (missing.length > 0) {
    throw new EnvValidationError(missing);
  }
}

export const domainUrl: string = ALLOWED_DOMAIN;
export const url: string = `${ALLOWED_DOMAIN}/eboibfront/ca`;

export const wordsToSearch: string[] = [
  process.env.WORDTOSEARCH_1,
  process.env.WORDTOSEARCH_2,
  process.env.WORDTOSEARCH_3,
  process.env.WORDTOSEARCH_4,
  process.env.WORDTOSEARCH_5,
  process.env.WORDTOSEARCH_6,
  process.env.WORDTOSEARCH_7,
  process.env.WORDTOSEARCH_8,
  process.env.WORDTOSEARCH_9,
].filter((v): v is string => typeof v === "string" && v.trim() !== "");

export const customers: string[] = [
  process.env.CUSTOMER_1,
  process.env.CUSTOMER_2,
  process.env.CUSTOMER_3,
  process.env.CUSTOMER_4,
  process.env.CUSTOMER_5,
  process.env.CUSTOMER_6,
  process.env.CUSTOMER_7,
].filter((v): v is string => typeof v === "string" && v.trim() !== "");

export const sendEmailBool: boolean = process.env.SEND_EMAIL !== "false";
export const emailUser: string = process.env.ZOHO_USER || "";
export const emailPassword: string = process.env.ZOHO_PASSWORD || "";
export const emailRecipients: string[] = [
  process.env.RECIPIENT1 || "",
  process.env.RECIPIENT2 || "",
  process.env.RECIPIENT3 || "",
].filter((v): v is string => v.trim() !== "");

const smtpConfig = {
  host: "smtp.zoho.eu",
  port: 465,
  secure: true,
  auth: {
    user: emailUser,
    pass: emailPassword,
  },
};

export let transporter: Transporter = nodemailer.createTransport(smtpConfig);

export const months: string[] = [
  "gener",
  "febrer",
  "març",
  "abril",
  "maig",
  "juny",
  "juliol",
  "agost",
  "setembre",
  "octubre",
  "novembre",
  "desembre",
];

export const lastBoibInfoFile: string = "lastBoibInfo.json";

export let lastBoibInfo: BoibInfo = {
  ultimoBoletin: "",
  isExtraordinary: false,
  idBoib: "",
  idAnualBoib: "",
  dateLastBoib: "",
  linkUltimoBoletin: "",
  customersMatched: [],
  sectionLinks: [],
  numMatches: 0,
};

export let previousBoibInfo: BoibInfo = {
  ultimoBoletin: "",
  isExtraordinary: false,
  idBoib: "",
  idAnualBoib: "",
  dateLastBoib: "",
  linkUltimoBoletin: "",
  customersMatched: [],
  sectionLinks: [],
  numMatches: 0,
};

export let downloadedPdfPaths: string[] = [];
export let numMatches: number = 0;

export const HTTP_TIMEOUT = 15000;
export const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;

export function isAllowedUrl(link: string): boolean {
  try {
    const parsed = new URL(link);
    return parsed.origin === new URL(ALLOWED_DOMAIN).origin;
  } catch {
    return link.startsWith(ALLOWED_DOMAIN) || link.startsWith("/");
  }
}