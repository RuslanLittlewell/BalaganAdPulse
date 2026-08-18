import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  createClient, listClients, getClient, updateClient, deleteClient,
} from "../../src/clients/client.service.js";
import { NotFoundError } from "../../src/errors.js";
import { signInAs } from "../helpers/auth.js";

const MISSING = "00000000-0000-0000-0000-000000000000";

let ownerId: string;

beforeEach(async () => {
  await resetDb();
  ({ user: { id: ownerId } } = await signInAs());
});
afterAll(async () => { await prisma.$disconnect(); });

describe("client.service", () => {
  it("creates a client with name only", async () => {
    const c = await createClient(ownerId, { name: "Acme" });
    expect(c.id).toBeTruthy();
    expect(c.name).toBe("Acme");
    expect(c.niche).toBeNull();
  });
  it("returns the list", async () => {
    await createClient(ownerId, { name: "A" });
    await createClient(ownerId, { name: "B" });
    expect((await listClients(ownerId)).length).toBe(2);
  });
  it("getClient throws NotFoundError", async () => {
    await expect(getClient(ownerId, MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("hides another owner's client behind the same NotFoundError", async () => {
    const client = await createClient(ownerId, { name: "Acme" });
    const { user: other } = await signInAs("Other");
    await expect(getClient(other.id, client.id)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("updates a client", async () => {
    const c = await createClient(ownerId, { name: "A" });
    const u = await updateClient(ownerId, c.id, { niche: "fitness" });
    expect(u.niche).toBe("fitness");
  });
  it("updateClient throws NotFoundError", async () => {
    await expect(updateClient(ownerId, MISSING, { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
  });
  it("deletes a client", async () => {
    const c = await createClient(ownerId, { name: "A" });
    await deleteClient(ownerId, c.id);
    expect((await listClients(ownerId)).length).toBe(0);
  });
  it("deleteClient throws NotFoundError", async () => {
    await expect(deleteClient(ownerId, MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("stores monthlyBudget as Decimal without precision loss", async () => {
    const c = await createClient(ownerId, { name: "Acme", monthlyBudget: 1234.56 });
    expect(String(c.monthlyBudget)).toBe("1234.56");
    const fetched = await getClient(ownerId, c.id);
    expect(String(fetched.monthlyBudget)).toBe("1234.56");
  });
  it("seeds a Main campaign with the default properties", async () => {
    const client = await createClient(ownerId, { name: "Acme" });

    const campaigns = await prisma.campaign.findMany({ where: { clientId: client.id } });
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].name).toBe("Main");
    expect(campaigns[0].position).toBe(0);

    const properties = await prisma.campaignProperty.findMany({
      where: { campaignId: campaigns[0].id }, orderBy: { position: "asc" },
    });
    expect(properties).toHaveLength(11);
    expect(properties.map((property) => property.key)).toEqual([
      "spend", "impressions", "clicks", "ctr", "cpm", "cpc",
      "leads", "cpl", "revenue", "roas", "comment",
    ]);
  });
});
