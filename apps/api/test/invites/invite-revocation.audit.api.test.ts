import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { createInvite, grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let principal: SignedIn;
let clientId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Admin", { role: "ADMIN" });
  ({ clientId } = await seedProject(admin.user.id, "Acme"));
  principal = await signInAs("Принципал", { role: "CLIENT_ADMIN" });
  await grantAccess(principal.membership!.id, clientId);
});
afterAll(() => prisma.$disconnect());

const revocations = () => prisma.auditEvent.findMany({ where: { entityType: "invite" } });

describe("revoking an invitation", () => {
  it("writes one event with the email, role and registration type", async () => {
    const invite = await createInvite("to-revoke", { email: "new@acme.com" });

    const res = await request(app).delete(`/api/invites/${invite.id}`).set(admin.auth);

    expect(res.status).toBe(204);
    const events = await revocations();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "DELETE",
      entityId: invite.id,
      actorId: admin.membership!.id,
      clientId: null,
      leadId: null,
      summary: "Revoked the invitation for new@acme.com",
      changes: { before: { email: "new@acme.com", role: "MANAGER", registrationType: "EMPLOYEE" } },
    });
  });

  it("names no address for an invitation that has none", async () => {
    const invite = await createInvite("open");
    await request(app).delete(`/api/invites/${invite.id}`).set(admin.auth);

    expect((await revocations())[0]!.summary).toBe("Revoked an invitation");
  });

  it("is read by the principal of the invitation's client", async () => {
    const created = await request(app).post("/api/invites").set(principal.auth)
      .send({ registrationType: "CLIENT_STAFF", clientId });
    expect(created.status).toBe(201);

    expect((await request(app).delete(`/api/invites/${created.body.id}`).set(principal.auth)).status).toBe(204);

    const seen = await request(app).get("/api/audit").query({ entityType: "invite" }).set(principal.auth);
    expect(seen.body.items.map((event: { entityId: string }) => event.entityId)).toEqual([created.body.id]);
    expect(seen.body.items[0].clientId).toBe(clientId);
  });

  it("writes nothing for a used invitation, a missing one or a second revocation", async () => {
    const used = await createInvite("used", { usedAt: new Date() });
    const twice = await createInvite("twice");

    const refused = await request(app).delete(`/api/invites/${used.id}`).set(admin.auth);
    await request(app).delete(`/api/invites/00000000-0000-0000-0000-000000000000`).set(admin.auth);
    await request(app).delete(`/api/invites/${twice.id}`).set(admin.auth);
    await request(app).delete(`/api/invites/${twice.id}`).set(admin.auth);

    expect(refused.status).toBe(409);
    const events = await revocations();
    expect(events.map((event) => event.entityId)).toEqual([twice.id]);
  });

  it("belongs to no section", async () => {
    const invite = await createInvite("sectionless");
    await request(app).delete(`/api/invites/${invite.id}`).set(admin.auth);

    for (const section of ["projects", "tasks", "crm"]) {
      const res = await request(app).get("/api/audit").query({ section, entityType: "invite" }).set(admin.auth);
      expect(res.body.items, section).toHaveLength(0);
    }
  });
});
