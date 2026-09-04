import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  RESOURCES,
  ROLES,
  can,
  isCustomer,
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
      expectRow("read", "organization", ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"]);
    });

    it("is never created or deleted through the matrix", () => {
      expectRow("create", "organization", []);
      expectRow("delete", "organization", []);
    });
  });

  describe("members", () => {
    it("are seen and removed by an admin or a principal, and changed by an admin alone", () => {
      expectRow("read", "member", ["ADMIN", "CLIENT_ADMIN"]);
      expectRow("create", "member", ["ADMIN"]);
      expectRow("update", "member", ["ADMIN"]);
      expectRow("delete", "member", ["ADMIN", "CLIENT_ADMIN"]);
    });
  });

  describe("invitations", () => {
    it("are made, listed and revoked by an admin or a principal", () => {
      expectRow("read", "invite", ["ADMIN", "CLIENT_ADMIN"]);
      expectRow("create", "invite", ["ADMIN", "CLIENT_ADMIN"]);
      expectRow("update", "invite", ["ADMIN"]);
      expectRow("delete", "invite", ["ADMIN", "CLIENT_ADMIN"]);
    });
  });

  describe("clients", () => {
    it("are readable by every role, with grants deciding which ones", () => {
      expectRow("read", "client", ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"]);
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
      expectRow("read", "project", ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"]);
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
      expectRow("read", "campaign", ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"]);
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
    // A customer reads it and may raise a request on it. Which rows either of
    // them sees is reach's answer, not this table's — a client reaches only the
    // tasks marked as shown to them.
    it("is read by every role, including a customer", () => {
      expectRow("read", "task", ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"]);
    });

    it("is raised by staff and by a customer, never by a guest", () => {
      expectRow("create", "task", ["ADMIN", "MANAGER", "CLIENT", "CLIENT_ADMIN"]);
    });

    // A customer raises a request and then leaves it alone: changing or
    // withdrawing it is the agency's to do, and so is deciding what is shown.
    it("is changed and removed only by admins and managers", () => {
      expectRow("update", "task", ["ADMIN", "MANAGER"]);
      expectRow("delete", "task", ["ADMIN", "MANAGER"]);
    });
  });

  describe("the audit trail", () => {
    it("is readable by every role, with scope deciding how much", () => {
      expectRow("read", "audit", ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"]);
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

    // One exception, and it is the point of the client portal: a customer may
    // raise a task. They may not change or withdraw it afterwards, and they may
    // write nothing else at all.
    it("is true for a client-role member everywhere but raising a task", () => {
      for (const resource of RESOURCES) {
        for (const action of ["create", "update", "delete"] as const) {
          if (resource === "task" && action === "create") continue;
          expect(
            can(actor("CLIENT"), action, resource),
            `CLIENT ${action} ${resource}`,
          ).toBe(false);
        }
      }
      expect(can(actor("CLIENT"), "create", "task")).toBe(true);
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

/**
 * A customer's own people. The principal administers them — invites, revokes,
 * removes — and reads exactly what an ordinary customer reads. Being the
 * principal is authority over people, not over anything the agency owns.
 */
describe("the customer's principal", () => {
  it("is a role of its own", () => {
    expect(ROLES).toContain("CLIENT_ADMIN");
  });

  it("reads everything an ordinary customer reads", () => {
    for (const resource of RESOURCES) {
      if (resource === "invite" || resource === "member") continue;
      expect(
        can(actor("CLIENT_ADMIN"), "read", resource),
        `CLIENT_ADMIN read ${resource}`,
      ).toBe(can(actor("CLIENT"), "read", resource));
    }
  });

  it("administers its client's people and their invitations", () => {
    for (const action of ["read", "create", "delete"] as const) {
      expect(can(actor("CLIENT_ADMIN"), action, "invite"), `invite ${action}`).toBe(true);
    }
    expect(can(actor("CLIENT_ADMIN"), "read", "member")).toBe(true);
    expect(can(actor("CLIENT_ADMIN"), "delete", "member")).toBe(true);
  });

  // Which people, and whose, is reach's answer — this table only says that the
  // verb exists for the role.
  it("raises a task like any customer", () => {
    expect(can(actor("CLIENT_ADMIN"), "create", "task")).toBe(true);
    expect(can(actor("CLIENT_ADMIN"), "update", "task")).toBe(false);
    expect(can(actor("CLIENT_ADMIN"), "delete", "task")).toBe(false);
  });

  it("writes nothing the agency owns", () => {
    for (const resource of ["client", "project", "campaign", "organization"] as const) {
      for (const action of ["create", "update", "delete"] as const) {
        expect(
          can(actor("CLIENT_ADMIN"), action, resource),
          `CLIENT_ADMIN ${action} ${resource}`,
        ).toBe(false);
      }
    }
  });

  it("leaves an ordinary customer administering nobody", () => {
    for (const action of ["read", "create", "update", "delete"] as const) {
      expect(can(actor("CLIENT"), action, "invite"), `CLIENT ${action} invite`).toBe(false);
      expect(can(actor("CLIENT"), action, "member"), `CLIENT ${action} member`).toBe(false);
    }
  });
});

/**
 * Asked once rather than compared by name at each site. Every rule about the
 * customer side — what it reaches, which tasks it sees, that it is not the
 * agency's staff — is the same for both roles, and comparing names is how the
 * second one silently turned up among the employees.
 */
describe("isCustomer", () => {
  it("is true for both roles on the customer's side", () => {
    expect(isCustomer("CLIENT")).toBe(true);
    expect(isCustomer("CLIENT_ADMIN")).toBe(true);
  });

  it("is false for everyone the agency employs", () => {
    expect(isCustomer("ADMIN")).toBe(false);
    expect(isCustomer("MANAGER")).toBe(false);
    expect(isCustomer("GUEST")).toBe(false);
  });

  it("covers every role, so none is neither", () => {
    const customers = ROLES.filter(isCustomer);
    const staff = ROLES.filter((role) => !isCustomer(role));

    expect([...customers, ...staff].sort()).toEqual([...ROLES].sort());
    expect(customers).toEqual(["CLIENT", "CLIENT_ADMIN"]);
  });
});
