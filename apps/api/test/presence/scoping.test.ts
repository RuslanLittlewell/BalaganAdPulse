import { describe, expect, it } from "vitest";
import { discloses } from "../../src/modules/presence/index.js";
import type { PresencePerson, PresenceViewer } from "../../src/modules/presence/index.js";

const person = (fields: Partial<PresencePerson> = {}): PresencePerson => ({
  userId: "u1",
  membershipId: "m1",
  orgId: "org-1",
  role: "MANAGER",
  name: "Мария",
  image: null,
  clientIds: [],
  ...fields,
});

const viewer = (fields: Partial<PresenceViewer> = {}): PresenceViewer => ({
  orgId: "org-1",
  role: "ADMIN",
  clientIds: [],
  ...fields,
});

describe("who may know that somebody is online", () => {
  it("never discloses a person from another organization", () => {
    expect(discloses(viewer(), person({ orgId: "org-2" }))).toBe(false);
  });

  it("shows staff everyone in their own organization", () => {
    expect(discloses(viewer({ role: "ADMIN" }), person({ role: "CLIENT", clientIds: ["c1"] })))
      .toBe(true);
    expect(discloses(viewer({ role: "GUEST" }), person({ role: "MANAGER" }))).toBe(true);
  });

  it("shows a customer the staff they work with", () => {
    const customer = viewer({ role: "CLIENT", clientIds: ["c1"] });

    expect(discloses(customer, person({ role: "MANAGER" }))).toBe(true);
    expect(discloses(customer, person({ role: "ADMIN" }))).toBe(true);
  });

  it("shows a customer their own company's people and nobody else's", () => {
    const customer = viewer({ role: "CLIENT", clientIds: ["c1"] });

    expect(discloses(customer, person({ role: "CLIENT_ADMIN", clientIds: ["c1"] }))).toBe(true);
    expect(discloses(customer, person({ role: "CLIENT", clientIds: ["c2"] }))).toBe(false);
  });
});
