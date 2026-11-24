import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let manager: SignedIn;
let colleague: SignedIn;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Admin", { role: "ADMIN" });
  const { clientId } = await seedProject(admin.user.id, "Acme");
  manager = await signInAs("Мария", { role: "MANAGER" });
  colleague = await signInAs("Олег", { role: "MANAGER" });
  await grantAccess(manager.membership!.id, clientId);
  await grantAccess(colleague.membership!.id, clientId);
});
afterAll(() => prisma.$disconnect());

const removals = () => prisma.auditEvent.findMany({ where: { entityType: "member", action: "DELETE" } });
const listed = async (as: SignedIn) =>
  (await request(app).get("/api/audit").query({ entityType: "member" }).set(as.auth)).body.items as { entityId: string }[];

describe("removing a member", () => {
  it("writes one event with the name and role read before the row went, and no client or project", async () => {
    const res = await request(app).delete(`/api/members/${manager.membership!.id}`).set(admin.auth);

    expect(res.status).toBe(204);
    const events = await removals();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      entityId: manager.membership!.id,
      actorId: admin.membership!.id,
      clientId: null,
      projectId: null,
      leadId: null,
      summary: "Removed Мария from the organization",
      changes: { before: { name: "Мария", role: "MANAGER" } },
    });
  });

  it("is read by an admin and not by a manager", async () => {
    await request(app).delete(`/api/members/${manager.membership!.id}`).set(admin.auth);

    expect((await listed(admin)).map((event) => event.entityId)).toContain(manager.membership!.id);
    expect((await listed(colleague)).map((event) => event.entityId)).not.toContain(manager.membership!.id);
  });

  it("belongs to no section", async () => {
    await request(app).delete(`/api/members/${manager.membership!.id}`).set(admin.auth);

    for (const section of ["projects", "tasks", "crm"]) {
      const res = await request(app).get("/api/audit").query({ section, entityType: "member" }).set(admin.auth);
      expect(res.body.items, section).toHaveLength(0);
    }
  });

  it("writes nothing when removing the last admin or oneself is refused", async () => {
    const own = await request(app).delete(`/api/members/${admin.membership!.id}`).set(admin.auth);
    const missing = await request(app).delete("/api/members/00000000-0000-0000-0000-000000000000").set(admin.auth);
    const byManager = await request(app).delete(`/api/members/${colleague.membership!.id}`).set(manager.auth);

    expect([own.status, missing.status, byManager.status]).toEqual([409, 404, 403]);
    expect(await removals()).toHaveLength(0);
  });
});
