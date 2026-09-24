import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { DeterministicIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { createProjectUseCases, type ProjectRecord } from "../../src/modules/projects/index.js";

const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN" };
const manager: ActorContext = { ...admin, membershipId: "m2", role: "MANAGER" };
const guest: ActorContext = { ...admin, membershipId: "m3", role: "GUEST" };

function record(partial: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: "p1", clientId: "c1", name: "Acme Ads",
    priority: "NEW", image: null, avatarPath: null, position: 0,
    createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...partial,
  };
}

function fixture(seed: ProjectRecord[] = [], reachableClients = ["c1"]) {
  const context = {} as TransactionContext;
  const projects = new Map(seed.map((value) => [value.id, value]));
  const audit: Array<Record<string, unknown>> = [];
  const pictures = new Map<string, Uint8Array>();
  const grants: Array<{ context: TransactionContext; projectId: string; clientId: string; memberIds: readonly string[] }> = [];
  const eligibilityChecks: string[][] = [];
  const employees = ["e1", "e2"];

  const useCases = createProjectUseCases({
    projects: {
      create: async (_tx, input) => {
        const created = record({ ...input });
        projects.set(created.id, created);
        return created;
      },
      countForClient: async (clientId) =>
        [...projects.values()].filter((project) => project.clientId === clientId).length,
      listReachable: async (_actor, clientId) =>
        [...projects.values()].filter((project) => !clientId || project.clientId === clientId),
      findReachable: async (_actor, id) => projects.get(id) ?? null,
      update: async (_tx, id, input) => {
        const updated = { ...projects.get(id)!, ...input };
        projects.set(id, updated);
        return updated;
      },
      delete: async (_tx, id) => { projects.delete(id); },
    },
    clients: { isReachable: async (_actor, clientId) => reachableClients.includes(clientId) },
    pictures: {
      read: async (id) => pictures.get(id) ?? null,
      write: async (id, bytes) => { pictures.set(id, bytes); },
    },
    audit: { append: async (_tx, event) => { audit.push(event as never); } },
    staffing: {
      eligible: async (orgId, memberIds) => {
        eligibilityChecks.push([...memberIds]);
        return orgId === "org1" ? memberIds.filter((id) => employees.includes(id)) : [];
      },
      grant: async (tx, project, memberIds) => {
        grants.push({ context: tx, projectId: project.id, clientId: project.clientId, memberIds });
      },
    },
    ids: new DeterministicIdGenerator(["new-1", "new-2"]),
    unitOfWork: { run: (work) => work(context) },
  });
  return { useCases, projects, audit, pictures, grants, eligibilityChecks, context };
}

describe("creating a project", () => {
  it("stores it under the client and creates nothing beneath it", async () => {
    const { useCases } = fixture();
    const created = await useCases.create(admin, { clientId: "c1", name: "Acme Ads" });
    expect(created.clientId).toBe("c1");
  });

  it("appends it after the client's existing projects", async () => {
    const { useCases } = fixture([record({ id: "p1" }), record({ id: "p2" })]);
    const created = await useCases.create(admin, { clientId: "c1", name: "Third" });
    expect(created.position).toBe(2);
  });

  it("answers not-found when the client is out of reach", async () => {
    const { useCases, projects } = fixture([], []);
    await expect(useCases.create(admin, { clientId: "c1", name: "No" }))
      .rejects.toMatchObject({ category: "not-found" });
    expect(projects.size).toBe(0);
  });

  it("audits the creation against both the client and the project", async () => {
    const { useCases, audit } = fixture();
    const created = await useCases.create(admin, { clientId: "c1", name: "Acme Ads" });
    expect(audit[0]).toMatchObject({
      action: "CREATE", entityType: "project", entityId: created.id,
      clientId: "c1", projectId: created.id, summary: 'Created project “Acme Ads”',
    });
  });

  it("refuses a guest", async () => {
    const { useCases } = fixture();
    await expect(useCases.create(guest, { clientId: "c1", name: "No" }))
      .rejects.toMatchObject({ category: "forbidden" });
  });
});

describe("assigning staff while creating a project", () => {
  it("grants each named employee the new project inside the creating transaction", async () => {
    const { useCases, grants, context } = fixture();
    const created = await useCases.create(admin, { clientId: "c1", name: "Acme Ads", memberIds: ["e1", "e2"] });
    expect(grants).toEqual([{ context, projectId: created.id, clientId: "c1", memberIds: ["e1", "e2"] }]);
  });

  it("keeps the employees out of the stored project", async () => {
    const { useCases, projects } = fixture();
    const created = await useCases.create(admin, { clientId: "c1", name: "Acme Ads", memberIds: ["e1"] });
    expect(projects.get(created.id)).not.toHaveProperty("memberIds");
  });

  it("names an employee once however often they are listed", async () => {
    const { useCases, grants } = fixture();
    await useCases.create(admin, { clientId: "c1", name: "Acme Ads", memberIds: ["e1", "e1"] });
    expect(grants[0]?.memberIds).toEqual(["e1"]);
  });

  it("refuses a manager who names anyone, storing nothing", async () => {
    const { useCases, projects, grants } = fixture();
    await expect(useCases.create(manager, { clientId: "c1", name: "No", memberIds: ["e1"] }))
      .rejects.toMatchObject({ category: "forbidden" });
    expect(projects.size).toBe(0);
    expect(grants).toEqual([]);
  });

  it("refuses a list naming anyone who is not an eligible employee, storing nothing", async () => {
    const { useCases, projects, grants } = fixture();
    await expect(useCases.create(admin, { clientId: "c1", name: "No", memberIds: ["e1", "stranger"] }))
      .rejects.toMatchObject({ category: "validation" });
    expect(projects.size).toBe(0);
    expect(grants).toEqual([]);
  });

  it("leaves staffing alone when nobody is named", async () => {
    const { useCases, grants, eligibilityChecks } = fixture();
    await useCases.create(manager, { clientId: "c1", name: "A" });
    await useCases.create(manager, { clientId: "c1", name: "B", memberIds: [] });
    expect(grants).toEqual([]);
    expect(eligibilityChecks).toEqual([]);
  });
});

describe("reading projects", () => {
  it("lists what the actor reaches, narrowed to one client on request", async () => {
    const { useCases } = fixture([record({ id: "p1", clientId: "c1" }), record({ id: "p2", clientId: "c2" })]);
    expect((await useCases.list(admin)).map((p) => p.id)).toEqual(["p1", "p2"]);
    expect((await useCases.list(admin, "c2")).map((p) => p.id)).toEqual(["p2"]);
  });

  it("answers not-found for a project out of reach", async () => {
    const { useCases } = fixture();
    await expect(useCases.read(admin, "missing")).rejects.toMatchObject({ category: "not-found" });
  });

  it("inlines a stored logo as a data URL", async () => {
    const { useCases, pictures } = fixture([record({ id: "p1", image: "2026-09-01" })]);
    pictures.set("p1", Uint8Array.from([7]));
    expect((await useCases.read(admin, "p1")).image)
      .toBe(`data:image/png;base64,${Buffer.from([7]).toString("base64")}`);
  });

  it("treats a logo storage cannot serve as no logo", async () => {
    const { useCases } = fixture([record({ id: "p1", image: "2026-09-01" })]);
    expect((await useCases.read(admin, "p1")).image).toBeNull();
  });
});

describe("updating a project", () => {
  it("changes fields and audits it", async () => {
    const { useCases, audit } = fixture([record({ id: "p1" })]);
    const updated = await useCases.update(manager, "p1", { priority: "URGENT" });
    expect(updated.priority).toBe("URGENT");
    expect(audit.at(-1)).toMatchObject({ action: "UPDATE", entityType: "project" });
  });

  it("checks the new client is reachable before moving a project to it", async () => {
    const { useCases } = fixture([record({ id: "p1" })], ["c1"]);
    await expect(useCases.update(admin, "p1", { clientId: "elsewhere" }))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("answers not-found before it checks the role", async () => {
    const { useCases } = fixture();
    await expect(useCases.update(guest, "missing", { name: "x" }))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a guest a project it can reach", async () => {
    const { useCases } = fixture([record({ id: "p1" })]);
    await expect(useCases.update(guest, "p1", { name: "x" }))
      .rejects.toMatchObject({ category: "forbidden" });
  });
});

describe("deleting a project", () => {
  it("removes it and audits the removal", async () => {
    const { useCases, projects, audit } = fixture([record({ id: "p1" })]);
    await useCases.delete(admin, "p1");
    expect(projects.has("p1")).toBe(false);
    expect(audit.at(-1)).toMatchObject({ action: "DELETE", entityType: "project" });
  });

  it("is refused to a manager", async () => {
    const { useCases, projects } = fixture([record({ id: "p1" })]);
    await expect(useCases.delete(manager, "p1")).rejects.toMatchObject({ category: "forbidden" });
    expect(projects.has("p1")).toBe(true);
  });
});

describe("saving a project logo", () => {
  it("writes the bytes and marks that a logo exists", async () => {
    const { useCases, pictures, projects } = fixture([record({ id: "p1" })]);
    await useCases.savePicture(admin, "p1", Uint8Array.from([5]), '{"topType":"NoHair"}');
    expect(pictures.get("p1")).toEqual(Uint8Array.from([5]));
    expect(projects.get("p1")!.avatarPath).toBe('{"topType":"NoHair"}');
  });

  it("never touches storage for a project out of reach", async () => {
    const { useCases, pictures } = fixture();
    await expect(useCases.savePicture(admin, "missing", Uint8Array.from([5]), "{}"))
      .rejects.toMatchObject({ category: "not-found" });
    expect(pictures.size).toBe(0);
  });
});
