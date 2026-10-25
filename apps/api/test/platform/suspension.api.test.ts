import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { createMemberUseCases } from "../../src/modules/members/index.js";
import { PrismaMembershipDirectory } from "../../src/modules/members/infrastructure/prisma-membership-directory.js";
import { createConnectionRegistry, createTaskEventDelivery } from "../../src/modules/realtime/index.js";
import { taskMoved, type TaskRecord } from "../../src/modules/tasks/index.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { createInvite, currentOrg, signInAs, signInAsOutsider, signInAsPlatformAdmin } from "../helpers/auth.js";

const app = createApp();

beforeEach(async () => { await resetDb(); resetIdentityRateLimits(); });
afterAll(async () => { await prisma.$disconnect(); });

async function setStatus(status: "ACTIVE" | "SUSPENDED", orgId?: string) {
  const platform = await signInAsPlatformAdmin(`Platform ${status}`);
  const id = orgId ?? (await currentOrg()).id;
  const res = await request(app).patch(`/api/platform/organizations/${id}`).set(platform.auth).send({ status });
  expect(res.status).toBe(200);
}

describe("a suspended organization", () => {
  it("refuses its admin's very next request with a token issued before", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    expect((await request(app).get("/api/projects").set(auth)).status).toBe(200);

    await setStatus("SUSPENDED");
    const res = await request(app).get("/api/projects").set(auth);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { message: "Organization is suspended" } });
  });

  it("refuses every role and every organization endpoint", async () => {
    const members = await Promise.all((["ADMIN", "MANAGER", "GUEST", "CLIENT"] as const)
      .map((role) => signInAs(role, { role })));
    await setStatus("SUSPENDED");

    for (const { auth } of members) {
      for (const path of ["/api/projects", "/api/clients", "/api/tasks", "/api/crm/boards", "/api/summary"]) {
        expect((await request(app).get(path).set(auth)).status, path).toBe(403);
      }
    }
  });

  it("still describes the session, as suspended, with no clients and no modules", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await seedProject("", "Acme");
    await setStatus("SUSPENDED");
    const org = await currentOrg();

    const res = await request(app).get("/api/auth/me").set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      platformAdmin: false,
      organization: { id: org.id, status: "SUSPENDED" },
      role: "ADMIN",
      clientIds: [],
      modules: [],
    });
  });

  it("leaves every other organization working", async () => {
    const insider = await signInAs("Insider", { role: "ADMIN" });
    const outsider = await signInAsOutsider("Globex");

    await setStatus("SUSPENDED", outsider.org.id);

    expect((await request(app).get("/api/projects").set(outsider.auth)).status).toBe(403);
    expect((await request(app).get("/api/projects").set(insider.auth)).status).toBe(200);
  });

  it("keeps its data and returns it untouched on reactivation", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const { clientId, projectId } = await seedProject(user.id, "Acme");
    const task = await request(app).post("/api/tasks").set(auth)
      .send({ projectId, title: "Write the brief", priority: "MEDIUM" });
    const lead = await request(app).post(`/api/crm/boards/${projectId}/leads`).set(auth).send({ name: "Lead" });
    expect(task.status).toBe(201);
    expect(lead.status).toBe(201);

    await setStatus("SUSPENDED");
    await setStatus("ACTIVE");

    expect((await request(app).get(`/api/clients/${clientId}`).set(auth)).body).toMatchObject({ name: "Acme" });
    expect((await request(app).get(`/api/projects/${projectId}`).set(auth)).status).toBe(200);
    expect((await request(app).get(`/api/tasks/${task.body.id}`).set(auth)).body)
      .toMatchObject({ title: "Write the brief" });
    expect((await request(app).get(`/api/crm/boards/${projectId}/leads`).set(auth)).body)
      .toEqual([expect.objectContaining({ id: lead.body.id, name: "Lead" })]);
    expect((await request(app).get("/api/auth/me").set(auth)).body.modules)
      .toEqual(["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"]);
  });

  it("refuses registration against its invitation and creates no account", async () => {
    await createInvite("suspended", { role: "MANAGER" });
    await setStatus("SUSPENDED");

    expect((await request(app).get("/api/registration/suspended")).status).toBe(404);
    const res = await request(app).post("/api/auth/register").send({
      name: "Newcomer", email: "newcomer@acme.com", password: "hunter2hunter2", inviteCode: "suspended",
    });

    expect(res.status).toBe(403);
    expect(await prisma.user.findUnique({ where: { email: "newcomer@acme.com" } })).toBeNull();
  });
});

describe("realtime for a suspended organization", () => {
  it("stops delivering events to its members and resumes on reactivation", async () => {
    const { user } = await signInAs("Admin", { role: "ADMIN" });
    const org = await currentOrg();
    const registry = createConnectionRegistry();
    const delivery = createTaskEventDelivery({
      registry,
      members: createMemberUseCases({ memberships: new PrismaMembershipDirectory(prisma) } as never),
      projects: { contextFor: async () => ({ clientId: "c1" }) },
    });
    const send = vi.fn();
    registry.add({ principal: { id: user.id, name: user.name, email: user.email }, send });
    const task: TaskRecord = {
      id: "t1", projectId: "p1", orgId: org.id, title: "Brief", description: null,
      column: "IDEA", priority: "MEDIUM", createdById: "m1", participantIds: [],
      visibleToClient: false, position: 0, imageIds: [],
      createdAt: new Date("2026-10-01T00:00:00.000Z"), updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    } as TaskRecord;

    await setStatus("SUSPENDED");
    await delivery.deliver(taskMoved(task));
    expect(send).not.toHaveBeenCalled();

    await setStatus("ACTIVE");
    await delivery.deliver(taskMoved(task));
    expect(send).toHaveBeenCalledTimes(1);
  });
});
