import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  PrismaRecordRepository,
  PrismaValueRepository,
} from "../../src/modules/records/infrastructure/prisma-record-repositories.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function adapters() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  return {
    unitOfWork,
    records: new PrismaRecordRepository(prisma, unitOfWork),
    values: new PrismaValueRepository(prisma, unitOfWork),
  };
}

async function scenario() {
  const admin = await signInAs("Admin", { role: "ADMIN" });
  const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
  const campaign = await seedCampaign(projectId, "Main");
  const properties = await prisma.campaignProperty.findMany({ where: { campaignId: campaign.id } });
  const byKey = new Map(properties.map((property) => [property.key, property]));
  return { admin, clientId, campaign, byKey };
}

const uuid = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-a${String(n).repeat(3)}-${String(n).repeat(12)}`;

describe("Prisma record repository", () => {
  it("stores a day as a bare date and reads it back formatted", async () => {
    const { unitOfWork, records } = adapters();
    const { campaign } = await scenario();
    const created = await unitOfWork.run((context) => records.create(context, {
      id: uuid(1), campaignId: campaign.id, date: new Date("2026-09-01T00:00:00.000Z"),
    }));
    expect(created.date).toBe("2026-09-01");
  });

  it("finds the row already holding a day, and nothing for a free one", async () => {
    const { unitOfWork, records } = adapters();
    const { campaign } = await scenario();
    const day = new Date("2026-09-01T00:00:00.000Z");
    await unitOfWork.run((context) => records.create(context, {
      id: uuid(2), campaignId: campaign.id, date: day,
    }));
    expect((await records.findByDay(campaign.id, day))?.date).toBe("2026-09-01");
    expect(await records.findByDay(campaign.id, new Date("2026-09-02T00:00:00.000Z"))).toBeNull();
  });

  it("hides a row of a campaign the actor cannot reach", async () => {
    const { unitOfWork, records } = adapters();
    const { campaign, clientId } = await scenario();
    const created = await unitOfWork.run((context) => records.create(context, {
      id: uuid(3), campaignId: campaign.id, date: new Date("2026-09-01T00:00:00.000Z"),
    }));
    const manager = await signInAs("Manager", { role: "MANAGER" });

    expect(await records.findReachable(manager.actor!, created.id)).toBeNull();
    await grantAccess(manager.membership!.id, clientId);
    expect(await records.findReachable(manager.actor!, created.id)).not.toBeNull();
  });

  it("rolls a row back when the surrounding transaction fails", async () => {
    const { unitOfWork, records } = adapters();
    const { campaign } = await scenario();
    await expect(unitOfWork.run(async (context) => {
      await records.create(context, {
        id: uuid(4), campaignId: campaign.id, date: new Date("2026-09-03T00:00:00.000Z"),
      });
      throw new Error("the rest of the operation failed");
    })).rejects.toThrow("the rest of the operation failed");
    expect(await prisma.campaignRecord.count()).toBe(0);
  });
});

describe("Prisma value repository", () => {
  it("returns only the columns of the campaign asked about", async () => {
    const { values } = adapters();
    const { campaign, byKey } = await scenario();
    const found = await values.propertiesOf(campaign.id, [
      byKey.get("spend")!.id, "00000000-0000-0000-0000-000000000000",
    ]);
    expect(found.map((property) => property.name)).toEqual(["SPEND"]);
  });

  it("carries a column's formula through, so a computed one can be refused", async () => {
    const { values } = adapters();
    const { campaign, byKey } = await scenario();
    const [cpc] = await values.propertiesOf(campaign.id, [byKey.get("cpc")!.id]);
    expect(cpc.formula).not.toBeNull();
  });

  it("upserts a number, replaces it, and clears it by deleting the row", async () => {
    const { unitOfWork, values, records } = adapters();
    const { campaign, byKey } = await scenario();
    const record = await unitOfWork.run((context) => records.create(context, {
      id: uuid(5), campaignId: campaign.id, date: new Date("2026-09-01T00:00:00.000Z"),
    }));
    const spend = { id: byKey.get("spend")!.id, name: "SPEND", type: "MONEY" as const, formula: null };

    await unitOfWork.run((context) => values.write(context, record.id, spend, "100.0000"));
    expect((await values.storedFor(record.id, [spend.id])).get(spend.id))
      .toEqual({ numberValue: "100.0000", textValue: null });

    await unitOfWork.run((context) => values.write(context, record.id, spend, "125.0000"));
    expect((await values.storedFor(record.id, [spend.id])).get(spend.id)?.numberValue).toBe("125.0000");

    await unitOfWork.run((context) => values.write(context, record.id, spend, null));
    expect(await prisma.campaignPropertyValue.count({ where: { recordId: record.id } })).toBe(0);
  });

  it("stores text in the text column and leaves the number empty", async () => {
    const { unitOfWork, values, records } = adapters();
    const { campaign, byKey } = await scenario();
    const record = await unitOfWork.run((context) => records.create(context, {
      id: uuid(6), campaignId: campaign.id, date: new Date("2026-09-01T00:00:00.000Z"),
    }));
    const comment = { id: byKey.get("comment")!.id, name: "COMMENT", type: "TEXT" as const, formula: null };

    await unitOfWork.run((context) => values.write(context, record.id, comment, "note"));
    expect((await values.storedFor(record.id, [comment.id])).get(comment.id))
      .toEqual({ numberValue: null, textValue: "note" });
  });

  it("rolls a written value back with its transaction", async () => {
    const { unitOfWork, values, records } = adapters();
    const { campaign, byKey } = await scenario();
    const record = await unitOfWork.run((context) => records.create(context, {
      id: uuid(7), campaignId: campaign.id, date: new Date("2026-09-01T00:00:00.000Z"),
    }));
    const spend = { id: byKey.get("spend")!.id, name: "SPEND", type: "MONEY" as const, formula: null };

    await expect(unitOfWork.run(async (context) => {
      await values.write(context, record.id, spend, "1.0000");
      throw new Error("the rest of the operation failed");
    })).rejects.toThrow("the rest of the operation failed");
    expect(await prisma.campaignPropertyValue.count()).toBe(0);
  });
});
