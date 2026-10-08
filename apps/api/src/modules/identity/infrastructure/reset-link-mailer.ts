import type { MailMessage, MailTransport } from "#shared/infrastructure/mail.js";
import type { ResetLinkDelivery } from "../application/ports.js";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&#39;");

export function resetLinkMessage(recipient: { email: string; name: string }, link: string): MailMessage {
  const name = escapeHtml(recipient.name);
  const email = escapeHtml(recipient.email);
  return {
    to: recipient.email,
    subject: "Восстановление пароля в Balagan BI",
    text: [
      `Здравствуйте, ${recipient.name}!`,
      "",
      `Чтобы задать новый пароль для ${recipient.email}, перейдите по ссылке:`,
      link,
      "",
      "Ссылка действует 1 час и сработает один раз.",
      "Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо: пароль останется прежним.",
    ].join("\n"),
    html: [
      `<p>Здравствуйте, ${name}!</p>`,
      `<p>Чтобы задать новый пароль для ${email}, перейдите по ссылке:</p>`,
      `<p><a href="${escapeHtml(link)}">Задать новый пароль</a></p>`,
      "<p>Ссылка действует 1 час и сработает один раз.</p>",
      "<p>Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо: пароль останется прежним.</p>",
    ].join(""),
  };
}

export class ResetLinkMailer implements ResetLinkDelivery {
  readonly available: boolean;

  constructor(
    private readonly transport: MailTransport | null,
    private readonly appUrl: string | null,
  ) {
    this.available = transport !== null && appUrl !== null;
  }

  deliver(recipient: { email: string; name: string }, token: string): void {
    if (!this.transport || !this.appUrl) return;
    const link = `${this.appUrl}/password-reset/${token}`;
    this.transport.send(resetLinkMessage(recipient, link)).catch((error: unknown) => {
      console.error("Failed to send a password reset email:", error);
    });
  }
}
