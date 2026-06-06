import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailTransport } from "../../../src/infrastructure/email/transport.js";

const mockVerify = vi.fn();
const mockSendMail = vi.fn();

beforeEach(() => {
  mockVerify.mockReset();
  mockSendMail.mockReset();
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: mockVerify,
      sendMail: mockSendMail,
    })),
  },
}));

function makeConfig() {
  return {
    smtp: {
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "user@example.com",
      pass: "secret",
      recipients: ["alice@example.com"],
    },
    wordsToSearch: ["test"],
    customers: [],
    sendEmail: true,
    notifyNoMatch: false,
    stateFile: "state.json",
    pdfDownloadFolder: "pdfs",
    httpTimeout: 5000,
    maxContentLength: 10 * 1024 * 1024,
    maxPdfSize: 50 * 1024 * 1024,
    allowedDomain: "https://www.caib.es",
    baseUrl: "https://www.caib.es/eboibfront/ca",
  };
}

describe("createEmailTransport", () => {
  it("returns an object with verify and send methods", () => {
    const transport = createEmailTransport(makeConfig());
    expect(transport).toHaveProperty("verify");
    expect(transport).toHaveProperty("send");
  });

  it("verify calls transporter.verify", async () => {
    mockVerify.mockResolvedValueOnce(undefined);
    const transport = createEmailTransport(makeConfig());
    await expect(transport.verify()).resolves.toBeUndefined();
    expect(mockVerify).toHaveBeenCalledOnce();
  });

  it("send calls transporter.sendMail with options", async () => {
    mockSendMail.mockResolvedValueOnce({});
    const transport = createEmailTransport(makeConfig());
    const opts = {
      from: "user@example.com",
      to: "alice@example.com",
      subject: "Test",
      text: "body",
      attachments: [],
    };
    await transport.send(opts);
    expect(mockSendMail).toHaveBeenCalledWith(opts);
  });

  it("rethrows verify errors", async () => {
    mockVerify.mockRejectedValueOnce(new Error("Connection refused"));
    const transport = createEmailTransport(makeConfig());
    await expect(transport.verify()).rejects.toThrow("Connection refused");
  });

  it("rethrows send errors", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("Auth failed"));
    const transport = createEmailTransport(makeConfig());
    await expect(
      transport.send({
        from: "user@example.com",
        to: "alice@example.com",
        subject: "Test",
        text: "body",
        attachments: [],
      }),
    ).rejects.toThrow("Auth failed");
  });
});
