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
  it("is in Russian, names the organization and escapes it in the markup", () => {
    const message = trialLinkMessage(
      { email: "olga@acme.com", name: "Olga", organizationName: "A<b>&Co" },
      "https://app.example/trial/confirm/abc",
    );

    expect(message.subject).toBe("Подтверждение регистрации в Balagan BI");
    expect(message.text).toContain("«A<b>&Co»");
    expect(message.text).toContain("https://app.example/trial/confirm/abc");
    expect(message.html).toContain("A&lt;b&gt;&amp;Co");
    expect(message.html).not.toContain("<b>");
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
