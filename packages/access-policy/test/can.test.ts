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

function actor(role: Role): Actor {
  return {
    userId: "user-1",
    membershipId: "membership-1",
    orgId: "org-1",
    role,
  };
}

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
    it("is read by every role, including a customer", () => {
      expectRow("read", "task", ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"]);
    });

    it("is raised by staff and by a customer, never by a guest", () => {
      expectRow("create", "task", ["ADMIN", "MANAGER", "CLIENT", "CLIENT_ADMIN"]);
    });

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
