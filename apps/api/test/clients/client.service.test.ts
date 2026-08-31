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
    const u = await updateClient(ownerId, c.id, { phone: "+375 29 000-00-00" });
    expect(u.phone).toBe("+375 29 000-00-00");
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
});
