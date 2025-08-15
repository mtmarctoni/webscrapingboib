export type UrlString = string & { __urlBrand: never };
export type EmailString = string & { __emailBrand: never };

export interface EmailConfig {
  user: EmailString;
  password: string;
  recipients: EmailString[];
}

export interface SmtpConfig {
  host: UrlString;
  port: number;
  secure: boolean;
  auth: {
    user: EmailString;
    pass: string;
  };
}

export interface GlobalConfig {
  domainUrl: UrlString;
  url: UrlString;
  wordsToSearch: string[];
  customers: string[];
  sendEmailBool: boolean;
  emailUser: EmailString;
  emailPassword: string;
  emailRecipients: EmailString[];
  months: string[];
  lastBoibInfoFile: string;
  smtp: SmtpConfig;
}
