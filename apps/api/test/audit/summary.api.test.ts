import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
let auth: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  ({ auth } = await signInAs("Summary Actor"));
});
afterAll(async () => { await prisma.$disconnect(); });

describe("stored audit summaries", () => {
  it("stores a readable entity summary at write time", async () => {
    const client = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
    const event = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "client", entityId: client.body.id, action: "CREATE" },
    });

    expect(event.summary).toBe('Created client “Acme”');
  });

  // The summary is a sentence written when the event happened, not a view
  // rebuilt from today's rows. Renaming the thing afterwards must not rewrite
  // what the trail says was done.
  it("keeps the name an event was written with after the entity is renamed", async () => {
    const client = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
    const created = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "client", entityId: client.body.id, action: "CREATE" },
    });
    expect(created.summary).toBe('Created client “Acme”');

    await request(app).patch(`/api/clients/${client.body.id}`).set(auth)
      .send({ name: "Acme Digital" });

    const stored = await prisma.auditEvent.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.summary).toBe('Created client “Acme”');
  });
});
