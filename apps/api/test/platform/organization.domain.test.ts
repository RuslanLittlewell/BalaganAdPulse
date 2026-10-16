import { describe, expect, it } from "vitest";
import {
  firstAdminState,
  slugBase,
  uniqueSlug,
  type FirstAdminInvitation,
} from "../../src/modules/platform/domain/organization.js";

const NOW = new Date("2026-10-15T12:00:00.000Z");

const invitation = (partial: Partial<FirstAdminInvitation> = {}): FirstAdminInvitation => ({
  email: "owner@acme.com", code: "ABCDEFGH", usedAt: null, revokedAt: null, expiresAt: null, ...partial,
});

describe("an organization's slug", () => {
  it.each([
    ["Acme", "acme"],
    ["Acme & Sons, Ltd.", "acme-sons-ltd"],
    ["Балаган", "balagan"],
    ["Щука и Ёж", "schuka-i-ezh"],
    ["Café Ünïcode", "cafe-unicode"],
    ["  --  ", "organization"],
    ["中文", "organization"],
  ])("derives %j as %j", (name, slug) => {
    expect(slugBase(name)).toBe(slug);
  });

  it("stays short and never ends on a hyphen", () => {
    const slug = slugBase(`${"a".repeat(47)} tail`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("takes the first free numbered variant", () => {
    expect(uniqueSlug("acme", [])).toBe("acme");
    expect(uniqueSlug("acme", ["acme"])).toBe("acme-2");
    expect(uniqueSlug("acme", ["acme", "acme-2", "acme-3"])).toBe("acme-4");
    expect(uniqueSlug("acme", ["acme-2"])).toBe("acme");
  });
});

describe("the first administrator's state", () => {
  it("is pending until the invitation is used", () => {
    expect(firstAdminState(invitation(), NOW)).toBe("PENDING");
    expect(firstAdminState(invitation({ usedAt: NOW }), NOW)).toBe("ACCEPTED");
  });

  it("is absent once the invitation is revoked or expired unused", () => {
    expect(firstAdminState(invitation({ revokedAt: NOW }), NOW)).toBeNull();
    expect(firstAdminState(invitation({ expiresAt: NOW }), NOW)).toBeNull();
    expect(firstAdminState(invitation({ expiresAt: new Date(NOW.getTime() + 1) }), NOW)).toBe("PENDING");
  });
});
