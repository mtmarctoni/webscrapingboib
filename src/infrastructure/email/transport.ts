import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { AppConfig } from "../../config/environment.js";

export interface EmailTransport {
  send(options: { from: string; to: string; subject: string; text: string; attachments: { filename: string; path: string }[] }): Promise<void>;
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
    async send(options) {
      await transporter.sendMail(options);
    },
  };
}
