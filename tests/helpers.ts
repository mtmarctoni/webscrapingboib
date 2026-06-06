import type { AppConfig } from "../src/config/environment.js";

export function makeConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    baseUrl: "https://www.caib.es/eboibfront/ca",
    allowedDomain: "https://www.caib.es",
    wordsToSearch: [],
    customers: [],
    smtp: {
      host: "smtp.test.com",
      port: 465,
      secure: true,
      user: "user@test.com",
      pass: "secret",
      recipients: [],
    },
    stateFile: "lastBoibInfo.json",
    pdfDownloadFolder: "BOIBpdfs",
    sendEmail: false,
    notifyNoMatch: false,
    httpTimeout: 15000,
    maxContentLength: 50 * 1024 * 1024,
    maxPdfSize: 10 * 1024 * 1024,
    ...overrides,
  };
}
