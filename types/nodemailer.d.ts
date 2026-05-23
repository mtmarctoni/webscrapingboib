declare module "nodemailer" {
  interface SmtpOptions {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  }

  interface Attachment {
    filename?: string;
    path?: string;
    contentType?: string;
  }

  interface MailOptions {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: Attachment[];
  }

  interface Transporter {
    sendMail(mailOptions: MailOptions): Promise<unknown>;
    verify(): Promise<true>;
    close(): void;
  }

  function createTransport(options: SmtpOptions): Transporter;

  export { createTransport, type Transporter, type SmtpOptions, type MailOptions, type Attachment };
}