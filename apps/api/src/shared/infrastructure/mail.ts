import { createTransport, type Transporter } from "nodemailer";
import type { MailConfig } from "./config.js";

export interface MailAttachment {
  readonly filename: string;
  readonly content: Buffer;
  readonly contentType: string;
}

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly replyTo?: string;
  readonly attachments?: readonly MailAttachment[];
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
    const { attachments, ...rest } = message;
    await this.transporter.sendMail({
      from: this.config.from,
      ...rest,
      ...(attachments ? { attachments: attachments.map((attachment) => ({ ...attachment })) } : {}),
    });
  }
}

export class LogMailTransport implements MailTransport {
  async send(message: MailMessage): Promise<void> {
    const attached = (message.attachments ?? [])
      .map((attachment) => `\n[attachment] ${attachment.filename}, ${attachment.contentType}, ${attachment.content.length} bytes`)
      .join("");
    const replyTo = message.replyTo ? `, reply to ${message.replyTo}` : "";
    console.info(`Mail to ${message.to}${replyTo} (${message.subject}):\n${message.text}${attached}`);
  }
}
