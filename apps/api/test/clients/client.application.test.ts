import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { DeterministicIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { createClientUseCases, type ClientRecord } from "../../src/modules/clients/index.js";

const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN" };
const manager: ActorContext = { ...admin, membershipId: "m2", role: "MANAGER" };
const guest: ActorContext = { ...admin, membershipId: "m3", role: "GUEST" };

function record(partial: Partial<ClientRecord> = {}): ClientRecord {
  return {
    id: "c1", orgId: "org1", name: "Acme", fullName: null, organization: null, unp: null,
    phone: null, telegram: null, email: null, website: null, image: null, avatarPath: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...partial,
  };
}

function fixture(seed: ClientRecord[] = []) {
  const context = {} as TransactionContext;
  const clients = new Map(seed.map((value) => [value.id, value]));
  const grants: Array<{ clientId: string; membershipId: string }> = [];
  const audit: Array<{ action: string; entityId: string; summary: string }> = [];
  const pictures = new Map<string, Uint8Array>();

  const useCases = createClientUseCases({
    clients: {
      create: async (_tx, input, grantTo) => {
        const created = record({ ...input });
        clients.set(created.id, created);
        if (grantTo) grants.push({ clientId: created.id, membershipId: grantTo });
        return created;
      },
      listReachable: async () => [...clients.values()],
      findReachable: async (_actor, id) => clients.get(id) ?? null,
      update: async (_tx, id, input) => {
        const updated = { ...clients.get(id)!, ...input };
        clients.set(id, updated);
        return updated;
      },
      delete: async (_tx, id) => { clients.delete(id); },
      reachableIds: async () => [...clients.keys()],
    },
    pictures: {
      read: async (id) => pictures.get(id) ?? null,
      write: async (id, bytes) => { pictures.set(id, bytes); },
    },
    audit: { append: async (_tx, event) => { audit.push(event as never); } },
    ids: new DeterministicIdGenerator(["new-1", "new-2"]),
    unitOfWork: { run: (work) => work(context) },
  });
  return { useCases, clients, grants, audit, pictures };
}

describe("creating a client", () => {
  it("stores it against the actor's organization", async () => {
    const { useCases, clients } = fixture();
    const created = await useCases.create(admin, { name: "Acme" });
    expect(created.orgId).toBe("org1");
    expect(clients.get(created.id)?.name).toBe("Acme");
  });

  it("grants a manager reach over what they entered", async () => {
    const { useCases, grants } = fixture();
    const created = await useCases.create(manager, { name: "Mine" });
    expect(grants).toEqual([{ clientId: created.id, membershipId: "m2" }]);
  });

  it("grants an admin nothing, because their role already reaches everything", async () => {
    const { useCases, grants } = fixture();
    await useCases.create(admin, { name: "Theirs" });
    expect(grants).toEqual([]);
  });

  it("records the creation in the audit trail", async () => {
    const { useCases, audit } = fixture();
    const created = await useCases.create(admin, { name: "Acme" });
    expect(audit).toEqual([expect.objectContaining({
      action: "CREATE", entityType: "client", entityId: created.id, summary: 'Created client “Acme”',
    })]);
  });

  it("refuses a role that may not create clients", async () => {
    const { useCases, clients } = fixture();
    await expect(useCases.create(guest, { name: "No" }))
      .rejects.toMatchObject({ category: "forbidden" });
    expect(clients.size).toBe(0);
  });
});

describe("reading clients", () => {
  it("lists what the actor reaches", async () => {
    const { useCases } = fixture([record({ id: "c1" }), record({ id: "c2" })]);
    expect((await useCases.list(admin)).map((client) => client.id)).toEqual(["c1", "c2"]);
  });

  it("answers not-found for a client out of reach", async () => {
    const { useCases } = fixture();
    await expect(useCases.read(admin, "missing")).rejects.toMatchObject({ category: "not-found" });
  });

  it("inlines a stored picture as a data URL", async () => {
    const { useCases, pictures } = fixture([record({ id: "c1", image: "2026-09-01" })]);
    pictures.set("c1", Uint8Array.from([1, 2, 3]));
    const read = await useCases.read(admin, "c1");
    expect(read.image).toBe(`data:image/png;base64,${Buffer.from([1, 2, 3]).toString("base64")}`);
  });

  it("reports a picture storage cannot serve as no picture, not a broken client", async () => {
    const { useCases } = fixture([record({ id: "c1", image: "2026-09-01" })]);
    expect((await useCases.read(admin, "c1")).image).toBeNull();
  });
});

describe("updating a client", () => {
  it("changes the fields it was given and audits it", async () => {
    const { useCases, audit } = fixture([record({ id: "c1" })]);
    const updated = await useCases.update(admin, "c1", { phone: "+375" });
    expect(updated.phone).toBe("+375");
    expect(audit.at(-1)).toMatchObject({ action: "UPDATE", entityType: "client" });
  });

  it("answers not-found before it checks the role, so reach is never disclosed", async () => {
    const { useCases } = fixture();
    await expect(useCases.update(guest, "missing", { name: "x" }))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a guest a client it can reach", async () => {
    const { useCases } = fixture([record({ id: "c1" })]);
    await expect(useCases.update(guest, "c1", { name: "x" }))
      .rejects.toMatchObject({ category: "forbidden" });
  });
});

describe("deleting a client", () => {
  it("removes it and audits the removal", async () => {
    const { useCases, clients, audit } = fixture([record({ id: "c1" })]);
    await useCases.delete(admin, "c1");
    expect(clients.has("c1")).toBe(false);
    expect(audit.at(-1)).toMatchObject({ action: "DELETE", entityType: "client" });
  });

  it("is refused to a manager, who may edit but not delete", async () => {
    const { useCases, clients } = fixture([record({ id: "c1" })]);
    await expect(useCases.delete(manager, "c1")).rejects.toMatchObject({ category: "forbidden" });
    expect(clients.has("c1")).toBe(true);
  });
});

describe("saving a client picture", () => {
  it("writes the bytes and marks that a picture exists", async () => {
    const { useCases, pictures, clients } = fixture([record({ id: "c1" })]);
    await useCases.savePicture(admin, "c1", Uint8Array.from([9]), '{"topType":"NoHair"}');
    expect(pictures.get("c1")).toEqual(Uint8Array.from([9]));
    expect(clients.get("c1")!.avatarPath).toBe('{"topType":"NoHair"}');
    expect(clients.get("c1")!.image).toBeTruthy();
  });

  it("never touches storage for a client out of reach", async () => {
    const { useCases, pictures } = fixture();
    await expect(useCases.savePicture(admin, "missing", Uint8Array.from([9]), "{}"))
      .rejects.toMatchObject({ category: "not-found" });
    expect(pictures.size).toBe(0);
  });

  it("refuses a guest", async () => {
    const { useCases, pictures } = fixture([record({ id: "c1" })]);
    await expect(useCases.savePicture(guest, "c1", Uint8Array.from([9]), "{}"))
      .rejects.toMatchObject({ category: "forbidden" });
    expect(pictures.size).toBe(0);
  });
});
