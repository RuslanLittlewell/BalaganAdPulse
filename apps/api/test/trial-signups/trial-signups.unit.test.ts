import { describe, expect, it, vi } from "vitest";
import { createTrialSignupUseCases } from "../../src/modules/trial-signups/application/trial-signup-use-cases.js";
import { TrialLinkMailer, trialLinkMessage } from "../../src/modules/trial-signups/infrastructure/trial-link-mailer.js";
import { TrialTokenAdapter } from "../../src/modules/trial-signups/infrastructure/trial-token-adapter.js";

describe("a trial request without mail", () => {
  it("answers unavailable and stores nothing", async () => {
    const replace = vi.fn();
    const useCases = createTrialSignupUseCases({
      signups: { replace, find: vi.fn(), consume: vi.fn() },
      emails: { isRegistered: async () => false },
      tokens: new TrialTokenAdapter(),
      passwords: { hash: async () => "hash" },
      links: new TrialLinkMailer(null, null),
      provisioning: { provision: vi.fn() },
      ids: { generate: () => "id" },
      clock: { now: () => new Date() },
      unitOfWork: { run: (work) => work({} as never) },
    });

    await expect(useCases.request({
      organizationName: "Acme", name: "Olga", email: "olga@acme.com", password: "hunter2hunter2",
    })).rejects.toMatchObject({ category: "unavailable" });
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("the trial confirmation email", () => {
  it("is in Russian and carries the link and its lifetime", () => {
    const message = trialLinkMessage("olga@acme.com", "https://app.example/trial/confirm/abc");

    expect(message.to).toBe("olga@acme.com");
    expect(message.subject).toBe("Подтверждение регистрации в Balagan BI");
    expect(message.text).toContain("https://app.example/trial/confirm/abc");
    expect(message.text).toContain("24 часа");
    expect(message.html).toContain('href="https://app.example/trial/confirm/abc"');
  });

  it("repeats nothing the visitor typed", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    new TrialLinkMailer({ send }, "https://app.example").deliver(
      { email: "olga@acme.com", name: "Ваш аккаунт заблокирован, зайдите на evil.example", organizationName: "Срочно: evil.example" },
      "tok",
    );

    const message = send.mock.calls[0][0];
    expect(message.text).not.toContain("evil.example");
    expect(message.html).not.toContain("evil.example");
  });

  it("builds the link on the app address", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    new TrialLinkMailer({ send }, "https://app.example").deliver(
      { email: "olga@acme.com", name: "Olga", organizationName: "Acme" },
      "tok",
    );
    expect(send.mock.calls[0][0].text).toContain("https://app.example/trial/confirm/tok");
  });
});

describe("trial tokens", () => {
  it("expire a day after they are issued", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    expect(new TrialTokenAdapter().expiry(now).toISOString()).toBe("2026-11-21T10:00:00.000Z");
  });
});
