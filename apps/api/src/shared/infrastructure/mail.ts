import { createTransport, type Transporter } from "nodemailer";
import type { MailConfig } from "./config.js";

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;

  constructor(private readonly config: MailConfig) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.config.from, ...message });
  }
}

export class LogMailTransport implements MailTransport {
  async send(message: MailMessage): Promise<void> {
    console.info(`Mail to ${message.to} (${message.subject}):\n${message.text}`);
  }
}
