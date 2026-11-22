import type { MailMessage, MailTransport } from "#shared/infrastructure/mail.js";
import type { TrialLinkDelivery } from "../application/ports.js";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&#39;");

export function trialLinkMessage(email: string, link: string): MailMessage {
  return {
    to: email,
    subject: "Подтверждение регистрации в Balagan BI",
    text: [
      "Здравствуйте!",
      "",
      "Чтобы создать организацию в Balagan BI и начать пробный период, перейдите по ссылке:",
      link,
      "",
      "Ссылка действует 24 часа и сработает один раз.",
      "Если вы не регистрировались в Balagan BI, просто проигнорируйте это письмо: ничего не будет создано.",
    ].join("\n"),
    html: [
      "<p>Здравствуйте!</p>",
      "<p>Чтобы создать организацию в Balagan BI и начать пробный период, перейдите по ссылке:</p>",
      `<p><a href="${escapeHtml(link)}">Подтвердить регистрацию</a></p>`,
      "<p>Ссылка действует 24 часа и сработает один раз.</p>",
      "<p>Если вы не регистрировались в Balagan BI, просто проигнорируйте это письмо: ничего не будет создано.</p>",
    ].join(""),
  };
}

export class TrialLinkMailer implements TrialLinkDelivery {
  readonly available: boolean;

  constructor(
    private readonly transport: MailTransport | null,
    private readonly appUrl: string | null,
  ) {
    this.available = transport !== null && appUrl !== null;
  }

  deliver(recipient: { email: string; name: string; organizationName: string }, token: string): void {
    if (!this.transport || !this.appUrl) return;
    const link = `${this.appUrl}/trial/confirm/${token}`;
    this.transport.send(trialLinkMessage(recipient.email, link)).catch((error: unknown) => {
      console.error("Failed to send a trial confirmation email:", error);
    });
  }
}
