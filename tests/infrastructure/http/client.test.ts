import nock from "nock";
import { describe, expect, it } from "vitest";
import { createHttpClient } from "../../../src/infrastructure/http/client.js";

describe("createHttpClient", () => {
  const allowedDomain = "https://www.caib.es";
  const config = {
    baseUrl: `${allowedDomain}/eboibfront/ca`,
    allowedDomain,
    wordsToSearch: ["test"],
    customers: [],
    sendEmail: false,
    stateFile: "state.json",
    pdfDownloadFolder: "pdfs",
    httpTimeout: 5000,
    maxContentLength: 10 * 1024 * 1024,
    maxPdfSize: 50 * 1024 * 1024,
    smtp: {
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "user@example.com",
      pass: "password",
      recipients: [],
    },
  };

  describe("URL whitelisting", () => {
    it("blocks disallowed URLs", async () => {
      const client = createHttpClient(config);
      await expect(client.get("https://evil.com/data")).rejects.toThrow("Blocked disallowed URL");
    });

    it("allows URLs on the allowed domain", async () => {
      const scope = nock(allowedDomain).get("/eboibfront/ca/test").reply(200, "OK");

      const client = createHttpClient(config);
      const response = await client.get(`${allowedDomain}/eboibfront/ca/test`);
      expect(response.status).toBe(200);
      expect(response.data).toBe("OK");
      scope.done();
    });
  });

  describe("retry behavior", () => {
    it("does not retry on 4xx client errors", async () => {
      const scope = nock(allowedDomain)
        .get("/notfound")
        .reply(404, "Not Found")
        .get("/notfound")
        .reply(200, "Should not reach here");

      const client = createHttpClient(config);
      // First call should fail immediately with 404 (no retry)
      // If it retried, the second nock handler would match
      await expect(client.get(`${allowedDomain}/notfound`)).rejects.toThrow("Request failed");
      expect(scope.isDone()).toBe(false); // second handler should not have been hit
    });

    it("retries on 5xx server errors", async () => {
      const scope = nock(allowedDomain)
        .get("/server-error")
        .reply(500, "Server Error")
        .get("/server-error")
        .reply(200, "OK after retry");

      const client = createHttpClient(config);
      const response = await client.get(`${allowedDomain}/server-error`);
      expect(response.status).toBe(200);
      expect(response.data).toBe("OK after retry");
      scope.done();
    });

    it("retries on network errors (no response)", async () => {
      const scope = nock(allowedDomain)
        .get("/network-error")
        .replyWithError("ECONNREFUSED")
        .get("/network-error")
        .reply(200, "OK after retry");

      const client = createHttpClient(config);
      const response = await client.get(`${allowedDomain}/network-error`);
      expect(response.status).toBe(200);
      expect(response.data).toBe("OK after retry");
      scope.done();
    });

    it("gives up after max retries on persistent 5xx", async () => {
      const scope = nock(allowedDomain).get("/always-500").times(3).reply(500, "Server Error");

      const client = createHttpClient(config);
      await expect(client.get(`${allowedDomain}/always-500`)).rejects.toThrow(
        "Failed after 3 retries",
      );
      scope.done();
    });
  });

  describe("getBuffer", () => {
    it("returns buffer for PDF content", async () => {
      const pdfContent = Buffer.from("%PDF-1.4 test");
      const scope = nock(allowedDomain)
        .get("/doc.pdf")
        .reply(200, pdfContent, { "Content-Type": "application/pdf" });

      const client = createHttpClient(config);
      const buffer = await client.getBuffer(`${allowedDomain}/doc.pdf`, config.maxPdfSize);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe("%PDF-1.4 test");
      scope.done();
    });

    it("throws on non-PDF content type", async () => {
      const scope = nock(allowedDomain)
        .get("/doc.html")
        .reply(200, "<html></html>", { "Content-Type": "text/html" });

      const client = createHttpClient(config);
      await expect(
        client.getBuffer(`${allowedDomain}/doc.html`, config.maxPdfSize),
      ).rejects.toThrow('Expected application/pdf, got "text/html"');
      scope.done();
    });
  });
});
