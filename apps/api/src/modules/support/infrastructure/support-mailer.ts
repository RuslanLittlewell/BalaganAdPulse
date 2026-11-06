import type { MailMessage, MailTransport } from "#shared/infrastructure/mail.js";
import type { SupportMailbox } from "../application/ports.js";
import { SCREENSHOT_EXTENSIONS, TOPIC_TITLES, type Feedback } from "../domain/feedback.js";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&#39;");

const NOT_GIVEN = "не указано";

function senderLine(feedback: Feedback): string {
  const { name, email, login } = feedback.sender;
  if (email) return `${name} <${email}>`;
  return login ? `${name}, логин ${login}` : name;
}

function contextRows(feedback: Feedback): Array<readonly [string, string]> {
  const { sender, context } = feedback;
  return [
    ["Организация", sender.organization],
    ["Отправитель", senderLine(feedback)],
    ["Роль", sender.role],
    ["Тариф", sender.tariff],
    ["Страница", context.page ?? NOT_GIVEN],
    ["Браузер", context.userAgent ?? NOT_GIVEN],
    ["Экран", context.screen ?? NOT_GIVEN],
    ["Отправлено", feedback.sentAt.toISOString()],
    ["Скриншотов", String(feedback.screenshots.length)],
  ];
}

export function feedbackMessage(to: string, feedback: Feedback): MailMessage {
  const topic = TOPIC_TITLES[feedback.topic];
  const rows = contextRows(feedback);
  return {
    to,
    subject: `[Balagan BI] ${topic} · ${feedback.sender.organization}`,
    ...(feedback.sender.email ? { replyTo: feedback.sender.email } : {}),
    text: [
      `Тема: ${topic}`,
      "",
      feedback.message,
      "",
      "---",
      ...rows.map(([label, value]) => `${label}: ${value}`),
    ].join("\n"),
    html: [
      `<p><strong>${escapeHtml(topic)}</strong></p>`,
      `<p style="white-space: pre-wrap">${escapeHtml(feedback.message)}</p>`,
      "<hr>",
      "<table>",
      ...rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`),
      "</table>",
    ].join(""),
    attachments: feedback.screenshots.map((screenshot, index) => ({
      filename: `screenshot-${index + 1}.${SCREENSHOT_EXTENSIONS[screenshot.type]}`,
      content: screenshot.bytes,
      contentType: screenshot.type,
    })),
  };
}

export class SupportMailer implements SupportMailbox {
  readonly available: boolean;

  constructor(
    private readonly transport: MailTransport | null,
    readonly address: string | null,
  ) {
    this.available = transport !== null && address !== null;
  }

  async deliver(feedback: Feedback): Promise<void> {
    if (!this.transport || !this.address) throw new Error("Support mail is not configured");
    await this.transport.send(feedbackMessage(this.address, feedback));
  }
}
