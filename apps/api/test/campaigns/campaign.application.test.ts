import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import type { ActorContext } from "../../src/shared/application/index.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { DeterministicIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import {
  createCampaignUseCases,
  type CampaignRecord,
  type PropertyRecord,
} from "../../src/modules/campaigns/index.js";

const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN" };
const guest: ActorContext = { ...admin, membershipId: "m3", role: "GUEST" };

const div = (a: string, b: string) => ({
  kind: "binary" as const, op: "/" as const,
  left: { kind: "property" as const, propertyId: a },
  right: { kind: "property" as const, propertyId: b },
});

function fixture(options: {
  campaigns?: CampaignRecord[];
  properties?: PropertyRecord[];
  valueCounts?: Record<string, number>;
  reachableProjects?: string[];
} = {}) {
  const context = {} as TransactionContext;
  const campaigns = new Map((options.campaigns ?? []).map((c) => [c.id, c]));
  const properties = new Map((options.properties ?? []).map((p) => [p.id, p]));
  const valueCounts = options.valueCounts ?? {};
  const reachableProjects = options.reachableProjects ?? ["proj1"];
  const audit: Array<Record<string, unknown>> = [];
  const renumbered: Array<{ campaignId: string; movedId?: string; position?: number }> = [];

  const useCases = createCampaignUseCases({
    campaigns: {
      create: async (_tx, input) => {
        const created: CampaignRecord = { ...input };
        campaigns.set(created.id, created);
        return created;
      },
      countForProject: async (projectId) =>
        [...campaigns.values()].filter((c) => c.projectId === projectId).length,
      listForProject: async (projectId) =>
        [...campaigns.values()].filter((c) => c.projectId === projectId)
          .sort((a, b) => a.position - b.position),
      findReachable: async (_actor, id) => campaigns.get(id) ?? null,
      rename: async (_tx, id, name) => { campaigns.set(id, { ...campaigns.get(id)!, name }); },
      delete: async (_tx, id) => { campaigns.delete(id); },
      renumber: async (_tx, projectId, movedId, position) => {
        renumbered.push({ campaignId: projectId, movedId, position });
      },
      readTable: async (_actor, id) => {
        const campaign = campaigns.get(id);
        if (!campaign) return null;
        return {
          campaign,
          properties: [...properties.values()].filter((p) => p.campaignId === id),
          records: [{
            id: "r1", date: "2026-09-01",
            storedValues: [{ propertyId: "spend", numberValue: new Decimal("100"), textValue: null }],
          }],
        };
      },
    },
    properties: {
      siblings: async (campaignId) =>
        [...properties.values()].filter((p) => p.campaignId === campaignId)
          .sort((a, b) => a.position - b.position),
      findReachable: async (_actor, id) => properties.get(id) ?? null,
      create: async (_tx, input) => {
        const created: PropertyRecord = { ...input };
        properties.set(created.id, created);
        return created;
      },
      shiftFrom: async () => undefined,
      update: async (_tx, id, data) => { properties.set(id, { ...properties.get(id)!, ...data }); },
      delete: async (_tx, id) => { properties.delete(id); },
      renumber: async () => undefined,
      countValues: async (propertyId) => valueCounts[propertyId] ?? 0,
    },
    projects: {
      contextFor: async (_actor, projectId) =>
        reachableProjects.includes(projectId) ? { clientId: "c1" } : null,
    },
    auditContext: {
      forCampaign: async (campaignId) => ({ clientId: "c1", projectId: "proj1", campaignId }),
    },
    audit: { append: async (_tx, event) => { audit.push(event as never); } },
    ids: new DeterministicIdGenerator(["id-1", "id-2", "id-3"]),
    unitOfWork: { run: (work) => work(context) },
  });
  return { useCases, campaigns, properties, audit, renumbered };
}

const campaign = (partial: Partial<CampaignRecord> = {}): CampaignRecord => ({
  id: "cam1", projectId: "proj1", name: "Main", position: 0, ...partial,
});
const property = (partial: Partial<PropertyRecord> = {}): PropertyRecord => ({
  id: "spend", campaignId: "cam1", key: "spend", name: "SPEND", type: "MONEY",
  position: 0, formula: null, ...partial,
});

describe("creating a campaign", () => {
  it("appends it to the project and seeds its default columns", async () => {
    const { useCases, campaigns } = fixture({ campaigns: [campaign()] });
    const created = await useCases.create(admin, "proj1", { name: "Second" });
    expect(created.position).toBe(1);
    expect(campaigns.get(created.id)?.name).toBe("Second");
  });

  it("answers not-found when the project is out of reach", async () => {
    const { useCases } = fixture({ reachableProjects: [] });
    await expect(useCases.create(admin, "proj1", { name: "No" }))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a guest", async () => {
    const { useCases } = fixture();
    await expect(useCases.create(guest, "proj1", { name: "No" }))
      .rejects.toMatchObject({ category: "forbidden" });
  });

  it("audits against the client, project and campaign", async () => {
    const { useCases, audit } = fixture();
    const created = await useCases.create(admin, "proj1", { name: "Main" });
    expect(audit[0]).toMatchObject({
      action: "CREATE", entityType: "campaign", entityId: created.id,
      clientId: "c1", projectId: "proj1", campaignId: created.id,
    });
  });
});

describe("reading a campaign table", () => {
  it("returns the computed table with its totals", async () => {
    const { useCases } = fixture({
      campaigns: [campaign()],
      properties: [property()],
    });
    const table = await useCases.readTable(admin, "cam1");
    expect(table.records[0].values.spend).toBe("100.0000");
    expect(table.totals.spend).toBe("100.0000");
  });

  it("answers not-found for a campaign out of reach", async () => {
    const { useCases } = fixture();
    await expect(useCases.readTable(admin, "missing"))
      .rejects.toMatchObject({ category: "not-found" });
  });
});

describe("moving and renaming a campaign", () => {
  it("renames it", async () => {
    const { useCases, campaigns } = fixture({ campaigns: [campaign()] });
    await useCases.update(admin, "cam1", { name: "Renamed" });
    expect(campaigns.get("cam1")!.name).toBe("Renamed");
  });

  it("renumbers its siblings when it is moved", async () => {
    const { useCases, renumbered } = fixture({ campaigns: [campaign()] });
    await useCases.update(admin, "cam1", { position: 2 });
    expect(renumbered).toEqual([{ campaignId: "proj1", movedId: "cam1", position: 2 }]);
  });

  it("closes the gap when one is deleted", async () => {
    const { useCases, renumbered, campaigns } = fixture({ campaigns: [campaign()] });
    await useCases.delete(admin, "cam1");
    expect(campaigns.has("cam1")).toBe(false);
    expect(renumbered).toEqual([{ campaignId: "proj1", movedId: undefined, position: undefined }]);
  });

  it("refuses a guest either operation", async () => {
    const { useCases } = fixture({ campaigns: [campaign()] });
    await expect(useCases.update(guest, "cam1", { name: "x" }))
      .rejects.toMatchObject({ category: "forbidden" });
    await expect(useCases.delete(guest, "cam1")).rejects.toMatchObject({ category: "forbidden" });
  });
});

describe("creating a column", () => {
  it("appends it with no key, because only seeded columns have one", async () => {
    const { useCases } = fixture({ campaigns: [campaign()], properties: [property()] });
    const created = await useCases.createProperty(admin, "cam1", { name: "CLICKS", type: "NUMBER" });
    expect(created).toMatchObject({ key: null, position: 1, formula: null });
  });

  it("clamps a position beyond the end", async () => {
    const { useCases } = fixture({ campaigns: [campaign()], properties: [property()] });
    const created = await useCases.createProperty(admin, "cam1", { name: "X", type: "NUMBER", position: 99 });
    expect(created.position).toBe(1);
  });

  it("refuses a formula on a text column", async () => {
    const { useCases } = fixture({ campaigns: [campaign()], properties: [property()] });
    await expect(useCases.createProperty(admin, "cam1", {
      name: "X", type: "TEXT", formula: { kind: "const", value: "1" },
    })).rejects.toMatchObject({ category: "validation" });
  });

  it("refuses a formula referencing a column of another campaign", async () => {
    const { useCases } = fixture({ campaigns: [campaign()], properties: [property()] });
    await expect(useCases.createProperty(admin, "cam1", {
      name: "X", type: "NUMBER", formula: { kind: "property", propertyId: "elsewhere" },
    })).rejects.toMatchObject({ category: "validation" });
  });
});

describe("changing a column", () => {
  it("refuses adding a formula to a column that already holds values", async () => {
    const { useCases } = fixture({
      campaigns: [campaign()],
      properties: [property(), property({ id: "clicks", name: "CLICKS", type: "NUMBER", position: 1 })],
      valueCounts: { clicks: 3 },
    });
    await expect(useCases.updateProperty(admin, "clicks", { formula: div("spend", "spend") }))
      .rejects.toMatchObject({ category: "conflict" });
  });

  it("refuses crossing the text boundary while values exist", async () => {
    const { useCases } = fixture({
      campaigns: [campaign()], properties: [property()], valueCounts: { spend: 2 },
    });
    await expect(useCases.updateProperty(admin, "spend", { type: "TEXT" }))
      .rejects.toMatchObject({ category: "conflict" });
  });

  it("allows a type change that stays numeric even with values", async () => {
    const { useCases, properties } = fixture({
      campaigns: [campaign()], properties: [property()], valueCounts: { spend: 2 },
    });
    await useCases.updateProperty(admin, "spend", { type: "NUMBER" });
    expect(properties.get("spend")!.type).toBe("NUMBER");
  });

  it("turns a computed column back into an entered one", async () => {
    const { useCases, properties } = fixture({
      campaigns: [campaign()],
      properties: [property(), property({ id: "cpc", name: "CPC", position: 1, formula: div("spend", "spend") })],
    });
    await useCases.updateProperty(admin, "cpc", { formula: null });
    expect(properties.get("cpc")!.formula).toBeNull();
  });
});

describe("deleting a column", () => {
  it("refuses while another column's formula depends on it, and names it", async () => {
    const { useCases } = fixture({
      campaigns: [campaign()],
      properties: [property(), property({ id: "cpc", name: "CPC", position: 1, formula: div("spend", "spend") })],
    });
    await expect(useCases.deleteProperty(admin, "spend"))
      .rejects.toMatchObject({ category: "conflict", message: expect.stringContaining("CPC") });
  });

  it("removes an unreferenced column", async () => {
    const { useCases, properties } = fixture({ campaigns: [campaign()], properties: [property()] });
    await useCases.deleteProperty(admin, "spend");
    expect(properties.has("spend")).toBe(false);
  });
});
