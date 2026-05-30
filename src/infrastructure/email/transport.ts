import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";
import type { AppConfig } from "../../config/environment.js";

export interface EmailTransport {
  verify(): Promise<void>;
  send(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    attachments: { filename: string; path: string }[];
  }): Promise<void>;
}

export function createEmailTransport(config: AppConfig): EmailTransport {
  const transporter: Transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return {
    async verify(): Promise<void> {
      await transporter.verify();
    },
    async send(options) {
      await transporter.sendMail(options);
    },
  };
}
