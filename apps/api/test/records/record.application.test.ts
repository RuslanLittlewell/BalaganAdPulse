import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { DeterministicIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { createRecordUseCases } from "../../src/modules/records/index.js";
import type { RecordRow, WritableProperty } from "../../src/modules/records/index.js";

const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN" };
const guest: ActorContext = { ...admin, membershipId: "m2", role: "GUEST" };

const spend: WritableProperty = { id: "spend", name: "SPEND", type: "MONEY", formula: null };
const note: WritableProperty = { id: "note", name: "NOTE", type: "TEXT", formula: null };
const cpc: WritableProperty = {
  id: "cpc", name: "CPC", type: "MONEY", formula: { kind: "const", value: "1" },
};

function fixture(seed: RecordRow[] = [], reachable = true) {
  const context = {} as TransactionContext;
  const records = new Map(seed.map((row) => [row.id, row]));
  const written: Array<{ propertyId: string; value: string | null }> = [];
  const audit: Array<Record<string, unknown>> = [];
  const stored = new Map<string, { numberValue: string | null; textValue: string | null }>();

  const useCases = createRecordUseCases({
    records: {
      create: async (_tx, input) => {
        const row: RecordRow = {
          id: input.id, campaignId: input.campaignId,
          date: input.date.toISOString().slice(0, 10),
        };
        records.set(row.id, row);
        return row;
      },
      findReachable: async (_actor, id) => records.get(id) ?? null,
      findByDay: async (campaignId, date) =>
        [...records.values()].find((row) =>
          row.campaignId === campaignId && row.date === date.toISOString().slice(0, 10)) ?? null,
      update: async (_tx, id, date) => {
        const row = { ...records.get(id)!, date: date.toISOString().slice(0, 10) };
        records.set(id, row);
        return row;
      },
      delete: async (_tx, id) => { records.delete(id); },
    },
    values: {
      propertiesOf: async (_campaignId, ids) =>
        [spend, note, cpc].filter((property) => ids.includes(property.id)),
      storedFor: async () => stored,
      write: async (_tx, _recordId, property, value) => {
        written.push({ propertyId: property.id, value });
      },
    },
    campaigns: {
      contextFor: async () => (reachable ? { clientId: "c1", projectId: "p1" } : null),
      readTable: async () => ({
        records: [{ id: "r1", date: "2026-09-01", values: { spend: "150.5000" } }],
        totals: { spend: "150.5000" },
      }),
    },
    audit: { append: async (_tx, event) => { audit.push(event as never); } },
    ids: new DeterministicIdGenerator(["new-1", "new-2"]),
    unitOfWork: { run: (work) => work(context) },
  });
  return { useCases, records, written, audit, stored };
}

const row = (partial: Partial<RecordRow> = {}): RecordRow =>
  ({ id: "r1", campaignId: "cam1", date: "2026-09-01", ...partial });

describe("adding a day", () => {
  it("stores it against the campaign and audits it", async () => {
    const { useCases, audit } = fixture();
    const created = await useCases.create(admin, "cam1", { date: "2026-09-02" });
    expect(created.date).toBe("2026-09-02");
    expect(audit[0]).toMatchObject({
      action: "CREATE", entityType: "record", summary: "Created row 2026-09-02",
    });
  });

  it("refuses a second row for the same day", async () => {
    const { useCases } = fixture([row()]);
    await expect(useCases.create(admin, "cam1", { date: "2026-09-01" }))
      .rejects.toMatchObject({ category: "conflict" });
  });

  it("answers not-found when the campaign is out of reach", async () => {
    const { useCases } = fixture([], false);
    await expect(useCases.create(admin, "cam1", { date: "2026-09-02" }))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a guest", async () => {
    const { useCases } = fixture();
    await expect(useCases.create(guest, "cam1", { date: "2026-09-02" }))
      .rejects.toMatchObject({ category: "forbidden" });
  });
});

describe("moving and removing a day", () => {
  it("changes the date", async () => {
    const { useCases, records } = fixture([row()]);
    await useCases.update(admin, "r1", { date: "2026-09-05" });
    expect(records.get("r1")!.date).toBe("2026-09-05");
  });

  it("lets a row keep its own date", async () => {
    const { useCases } = fixture([row()]);
    await expect(useCases.update(admin, "r1", { date: "2026-09-01" })).resolves.toBeDefined();
  });

  it("refuses moving onto a day already taken", async () => {
    const { useCases } = fixture([row(), row({ id: "r2", date: "2026-09-02" })]);
    await expect(useCases.update(admin, "r1", { date: "2026-09-02" }))
      .rejects.toMatchObject({ category: "conflict" });
  });

  it("removes a row and audits it", async () => {
    const { useCases, records, audit } = fixture([row()]);
    await useCases.delete(admin, "r1");
    expect(records.has("r1")).toBe(false);
    expect(audit.at(-1)).toMatchObject({ action: "DELETE", entityType: "record" });
  });
});

describe("writing cells", () => {
  it("normalises a number to four decimals before storing it", async () => {
    const { useCases, written } = fixture([row()]);
    await useCases.setValue(admin, "r1", "spend", "150.5");
    expect(written).toEqual([{ propertyId: "spend", value: "150.5000" }]);
  });

  it("answers with the recomputed row and totals", async () => {
    const { useCases } = fixture([row()]);
    const result = await useCases.setValue(admin, "r1", "spend", "150.5");
    expect(result.record.values.spend).toBe("150.5000");
    expect(result.totals.spend).toBe("150.5000");
  });

  it("refuses a write to a computed column", async () => {
    const { useCases, written } = fixture([row()]);
    await expect(useCases.setValue(admin, "r1", "cpc", "1"))
      .rejects.toMatchObject({ category: "validation" });
    expect(written).toEqual([]);
  });

  it("refuses text in a numeric column", async () => {
    const { useCases } = fixture([row()]);
    await expect(useCases.setValue(admin, "r1", "spend", "lots"))
      .rejects.toMatchObject({ category: "validation" });
  });

  it("answers not-found for a column of another campaign", async () => {
    const { useCases } = fixture([row()]);
    await expect(useCases.setValue(admin, "r1", "elsewhere", "1"))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a guest", async () => {
    const { useCases, written } = fixture([row()]);
    await expect(useCases.setValue(guest, "r1", "spend", "1"))
      .rejects.toMatchObject({ category: "forbidden" });
    expect(written).toEqual([]);
  });

  it("names the cell, not the row, when a single cell is written", async () => {
    const { useCases, audit } = fixture([row()]);
    await useCases.setValue(admin, "r1", "spend", "1");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "UPDATE", entityType: "value", entityId: "r1:spend",
      summary: "Updated column “SPEND” on row 2026-09-01",
    });
    expect(audit[0].changes).toBeUndefined();
  });

  describe("a multi-cell write", () => {
    it("is one audit event listing every column it touched", async () => {
      const { useCases, audit } = fixture([row()]);
      await useCases.setValues(admin, "r1", [
        { propertyId: "spend", value: "150.5" },
        { propertyId: "note", value: "hello" },
      ]);
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        action: "UPDATE", entityType: "record", entityId: "r1",
        summary: "Updated row 2026-09-01",
        changes: [
          { field: "SPEND", before: null, after: "150.5000" },
          { field: "NOTE", before: null, after: "hello" },
        ],
      });
    });

    it("writes nothing at all when one cell is invalid", async () => {
      const { useCases, written, audit } = fixture([row()]);
      await expect(useCases.setValues(admin, "r1", [
        { propertyId: "spend", value: "150.5" },
        { propertyId: "note", value: "fine" },
        { propertyId: "cpc", value: "1" },
      ])).rejects.toMatchObject({ category: "validation" });
      expect(written).toEqual([]);
      expect(audit).toEqual([]);
    });

    it("carries the client and project into the audit context", async () => {
      const { useCases, audit } = fixture([row()]);
      await useCases.setValues(admin, "r1", [{ propertyId: "spend", value: "1" }]);
      expect(audit[0]).toMatchObject({ clientId: "c1", projectId: "p1", campaignId: "cam1" });
    });
  });
});
