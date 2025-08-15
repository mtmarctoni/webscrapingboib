import dotenv from "dotenv";
import nodemailer, { type Transporter } from "nodemailer";
dotenv.config();

import type { BoibInfo } from "../types/boibInfo.js";
import type { UrlString, EmailString, SmtpConfig } from "../types/global.js";

const domainUrl: UrlString = "https://www.caib.es" as UrlString;
const url: UrlString = (domainUrl + "/eboibfront/ca") as UrlString;
const wordsToSearch: string[] = [
  process.env.WORDTOSEARCH_1,
  process.env.WORDTOSEARCH_2,
  process.env.WORDTOSEARCH_3,
  process.env.WORDTOSEARCH_4,
  process.env.WORDTOSEARCH_5,
  process.env.WORDTOSEARCH_6,
  process.env.WORDTOSEARCH_7,
  process.env.WORDTOSEARCH_8,
  process.env.WORDTOSEARCH_9,
].filter(Boolean) as string[];

const customers: string[] = [
  process.env.CUSTOMER_1,
  process.env.CUSTOMER_2,
  process.env.CUSTOMER_3,
  process.env.CUSTOMER_4,
  process.env.CUSTOMER_5,
  process.env.CUSTOMER_6,
  process.env.CUSTOMER_7,
].filter(Boolean) as string[];

const sendEmailBool: boolean = true;
const emailUser: EmailString = (process.env.ZOHO_USER || "") as EmailString;
const emailPassword: string = process.env.ZOHO_PASSWORD || "";
const emailRecipients: EmailString[] = [
  process.env.RECIPIENT1 || "",
  process.env.RECIPIENT2 || "",
  process.env.RECIPIENT3 || "",
].filter(Boolean) as EmailString[];

const smtpConfig: SmtpConfig = {
  host: "smtp.zoho.eu" as UrlString,
  port: 465,
  secure: true, // true for 465, false for 587
  auth: {
    user: emailUser,
    pass: emailPassword,
  },
};
let transporter: Transporter = nodemailer.createTransport(smtpConfig);

const months: string[] = [
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
const lastBoibInfoFile: string = "lastBoibInfo.json";

let lastBoibInfo: BoibInfo = {
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
let previousBoibInfo: BoibInfo = {
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
let downloadedPdfPaths: string[] = [];
let numMatches: number = 0;

export {
  domainUrl,
  url,
  wordsToSearch,
  customers,
  sendEmailBool,
  emailUser,
  emailPassword,
  emailRecipients,
  months,
  lastBoibInfoFile,
  smtpConfig,
  transporter,
  lastBoibInfo,
  previousBoibInfo,
  downloadedPdfPaths,
  numMatches,
};
