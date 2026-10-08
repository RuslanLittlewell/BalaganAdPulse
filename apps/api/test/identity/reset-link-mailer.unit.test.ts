import { afterEach, describe, expect, it, vi } from "vitest";
import type { MailMessage } from "../../src/shared/infrastructure/mail.js";
import { ResetLinkMailer, resetLinkMessage } from "../../src/modules/identity/infrastructure/reset-link-mailer.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("the password reset email", () => {
  const message = resetLinkMessage(
    { email: "buyer@acme.com", name: "Пётр <b>" },
    "https://app.example.com/password-reset/abc",
  );

  it("is addressed to the account in Russian, with the link and its lifetime", () => {
    expect(message.to).toBe("buyer@acme.com");
    expect(message.subject).toBe("Восстановление пароля в Balagan BI");
    expect(message.text).toContain("Здравствуйте, Пётр <b>!");
    expect(message.text).toContain("https://app.example.com/password-reset/abc");
    expect(message.text).toContain("Ссылка действует 1 час");
    expect(message.text).toContain("проигнорируйте это письмо");
  });

  it("escapes what the account holder typed into the HTML", () => {
    expect(message.html).toContain("Пётр &lt;b&gt;");
    expect(message.html).not.toContain("Пётр <b>");
    expect(message.html).toContain('href="https://app.example.com/password-reset/abc"');
  });
});

describe("ResetLinkMailer", () => {
  it("builds the link on the app's address", async () => {
    const sent: MailMessage[] = [];
    const mailer = new ResetLinkMailer({ send: async (mail) => { sent.push(mail); } }, "https://app.example.com");

    mailer.deliver({ email: "buyer@acme.com", name: "Buyer" }, "token-1");

    expect(mailer.available).toBe(true);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].text).toContain("https://app.example.com/password-reset/token-1");
  });

  it("is unavailable without a transport or an address", () => {
    expect(new ResetLinkMailer(null, "https://app.example.com").available).toBe(false);
    expect(new ResetLinkMailer({ send: async () => undefined }, null).available).toBe(false);
  });

  it("logs a failed send instead of throwing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const mailer = new ResetLinkMailer({ send: async () => { throw new Error("smtp down"); } }, "https://app.example.com");

    expect(() => mailer.deliver({ email: "buyer@acme.com", name: "Buyer" }, "token-1")).not.toThrow();

    await vi.waitFor(() => expect(logged).toHaveBeenCalledWith("Failed to send a password reset email:", expect.any(Error)));
  });
});
