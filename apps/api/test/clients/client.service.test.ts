import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  createClient, listClients, getClient, updateClient, deleteClient,
} from "../../src/clients/client.service.js";
import { NotFoundError } from "../../src/errors.js";

const MISSING = "00000000-0000-0000-0000-000000000000";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("client.service", () => {
  it("creates a client with name only", async () => {
    const c = await createClient({ name: "Acme" });
    expect(c.id).toBeTruthy();
    expect(c.name).toBe("Acme");
    expect(c.niche).toBeNull();
  });
  it("returns the list", async () => {
    await createClient({ name: "A" });
    await createClient({ name: "B" });
    expect((await listClients()).length).toBe(2);
  });
  it("getClient throws NotFoundError", async () => {
    await expect(getClient(MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("updates a client", async () => {
    const c = await createClient({ name: "A" });
    const u = await updateClient(c.id, { niche: "fitness" });
    expect(u.niche).toBe("fitness");
  });
  it("updateClient throws NotFoundError", async () => {
    await expect(updateClient(MISSING, { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
  });
  it("deletes a client", async () => {
    const c = await createClient({ name: "A" });
    await deleteClient(c.id);
    expect((await listClients()).length).toBe(0);
  });
  it("deleteClient throws NotFoundError", async () => {
    await expect(deleteClient(MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });
  it("stores monthlyBudget as Decimal without precision loss", async () => {
    const c = await createClient({ name: "Acme", monthlyBudget: 1234.56 });
    expect(String(c.monthlyBudget)).toBe("1234.56");
    const fetched = await getClient(c.id);
    expect(String(fetched.monthlyBudget)).toBe("1234.56");
  });
});
