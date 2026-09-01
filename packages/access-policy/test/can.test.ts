import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  RESOURCES,
  ROLES,
  can,
  type Action,
  type Actor,
  type Resource,
  type Role,
} from "../src/index.js";

/** The matrix answers on the role alone; the rest of an actor is carried for
 * the caller's convenience, so a fixture only has to vary the role. */
function actor(role: Role): Actor {
  return {
    userId: "user-1",
    membershipId: "membership-1",
    orgId: "org-1",
    role,
  };
}

/** Asserts a whole matrix row at once: exactly `allowed` may act, and the
 * remaining roles may not. Writing it this way means a role added to the
 * matrix without a decision here fails the test rather than passing silently. */
function expectRow(action: Action, resource: Resource, allowed: Role[]): void {
  for (const role of ROLES) {
    expect(
      can(actor(role), action, resource),
      `${role} ${action} ${resource}`,
    ).toBe(allowed.includes(role));
  }
}

describe("can", () => {
  describe("organization settings", () => {
    it("is editable by an admin alone", () => {
      expectRow("update", "organization", ["ADMIN"]);
    });

    it("is readable by every role, since each one is shown the organization", () => {
      expectRow("read", "organization", ["ADMIN", "MANAGER", "GUEST", "CLIENT"]);
    });

    it("is never created or deleted through the matrix", () => {
      expectRow("create", "organization", []);
      expectRow("delete", "organization", []);
    });
  });

  describe("members", () => {
    it("are listed, changed, added and removed by an admin alone", () => {
      expectRow("read", "member", ["ADMIN"]);
      expectRow("create", "member", ["ADMIN"]);
      expectRow("update", "member", ["ADMIN"]);
      expectRow("delete", "member", ["ADMIN"]);
    });
  });

  describe("invitations", () => {
    it("are created, listed and revoked by an admin alone", () => {
      expectRow("read", "invite", ["ADMIN"]);
      expectRow("create", "invite", ["ADMIN"]);
      expectRow("update", "invite", ["ADMIN"]);
      expectRow("delete", "invite", ["ADMIN"]);
    });
  });

  describe("clients", () => {
    it("are readable by every role, with grants deciding which ones", () => {
      expectRow("read", "client", ["ADMIN", "MANAGER", "GUEST", "CLIENT"]);
    });

    it("are created and edited by admins and managers", () => {
      expectRow("create", "client", ["ADMIN", "MANAGER"]);
      expectRow("update", "client", ["ADMIN", "MANAGER"]);
    });

    it("are deleted by an admin alone", () => {
      expectRow("delete", "client", ["ADMIN"]);
    });
  });

  describe("projects", () => {
    it("are readable by every role", () => {
      expectRow("read", "project", ["ADMIN", "MANAGER", "GUEST", "CLIENT"]);
    });

    it("are created and edited by admins and managers", () => {
      expectRow("create", "project", ["ADMIN", "MANAGER"]);
      expectRow("update", "project", ["ADMIN", "MANAGER"]);
    });

    it("are deleted by an admin alone", () => {
      expectRow("delete", "project", ["ADMIN"]);
    });
  });

  describe("the campaign hierarchy", () => {
    // One resource covers the campaign, its ad sets, its ads and their measured
    // figures: a role has an opinion about the hierarchy, not about its levels.
    it("lets admins and managers write it, and everyone else only read", () => {
      expectRow("read", "campaign", ["ADMIN", "MANAGER", "GUEST", "CLIENT"]);
      expectRow("create", "campaign", ["ADMIN", "MANAGER"]);
      expectRow("update", "campaign", ["ADMIN", "MANAGER"]);
      expectRow("delete", "campaign", ["ADMIN", "MANAGER"]);
    });

    it("names no resource for the sheet it replaced", () => {
      expect(RESOURCES).not.toContain("property");
      expect(RESOURCES).not.toContain("record");
      expect(RESOURCES).not.toContain("value");
    });
  });

  describe("the task board", () => {
    it("is read by staff and guests, and never by a customer", () => {
      expectRow("read", "task", ["ADMIN", "MANAGER", "GUEST"]);
    });

    it("is written only by admins and managers", () => {
      expectRow("create", "task", ["ADMIN", "MANAGER"]);
      expectRow("update", "task", ["ADMIN", "MANAGER"]);
      expectRow("delete", "task", ["ADMIN", "MANAGER"]);
    });
  });

  describe("the audit trail", () => {
    it("is readable by every role, with scope deciding how much", () => {
      expectRow("read", "audit", ["ADMIN", "MANAGER", "GUEST", "CLIENT"]);
    });

    it("is never written through the API", () => {
      expectRow("create", "audit", []);
      expectRow("update", "audit", []);
      expectRow("delete", "audit", []);
    });
  });

  describe("guests never write", () => {
    it("is true for every resource and every writing verb", () => {
      for (const resource of RESOURCES) {
        for (const action of ["create", "update", "delete"] as const) {
          expect(
            can(actor("GUEST"), action, resource),
            `GUEST ${action} ${resource}`,
          ).toBe(false);
        }
      }
    });

    it("is true for a client-role member too", () => {
      for (const resource of RESOURCES) {
        for (const action of ["create", "update", "delete"] as const) {
          expect(
            can(actor("CLIENT"), action, resource),
            `CLIENT ${action} ${resource}`,
          ).toBe(false);
        }
      }
    });
  });

  describe("as a total function", () => {
    it("answers a boolean for every role, action and resource", () => {
      for (const role of ROLES) {
        for (const action of ACTIONS) {
          for (const resource of RESOURCES) {
            expect(typeof can(actor(role), action, resource)).toBe("boolean");
          }
        }
      }
    });

    it("fails closed on an action or resource outside the matrix", () => {
      expect(can(actor("ADMIN"), "explode" as Action, "client")).toBe(false);
      expect(can(actor("ADMIN"), "read", "spaceship" as Resource)).toBe(false);
      expect(can({ ...actor("ADMIN"), role: "ROOT" as Role }, "read", "client")).toBe(false);
    });
  });
});
