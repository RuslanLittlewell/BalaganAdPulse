import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { OrgModule } from "@prisma/client";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs, signInAsOutsider, signInAsPlatformAdmin } from "../helpers/auth.js";

const app = createApp();

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

async function entitle(modules: OrgModule[], orgId?: string) {
  await prisma.organization.update({
    where: { id: orgId ?? (await currentOrg()).id },
    data: { modules },
  });
}

const GUARDED: ReadonlyArray<readonly [OrgModule, string, (projectId: string) => string]> = [
  ["CRM", "GET", () => "/api/crm/boards"],
  ["TASKS", "GET", () => "/api/tasks"],
  ["TASKS", "POST", () => "/api/task-images"],
  ["REPORTS", "GET", () => "/api/reports"],
  ["REPORTS", "GET", (projectId) => `/api/projects/${projectId}/reports`],
];

const call = (method: string, path: string, auth: { Authorization: string }) =>
  method === "POST" ? request(app).post(path).set(auth) : request(app).get(path).set(auth);

describe("a disabled module does not exist for the organization", () => {
  it.each(GUARDED)("answers %s %s %s with 404 when the module is off", async (module, method, path) => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(user.id);
    await entitle(["CRM", "TASKS", "REPORTS"].filter((key) => key !== module) as OrgModule[]);

    const res = await call(method, path(projectId), auth);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: "Endpoint not found" } });
  });

  it.each(GUARDED)("serves %s %s %s when the module is on", async (_module, method, path) => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(user.id);

    const res = await call(method, path(projectId), auth);

    expect(res.status).not.toBe(404);
    expect(res.status).toBeLessThan(500);
  });

  it("refuses every role alike", async () => {
    await entitle([]);
    for (const role of ["ADMIN", "MANAGER", "GUEST", "CLIENT"] as const) {
      const { auth } = await signInAs(role, { role });
      expect((await request(app).get("/api/tasks").set(auth)).status, role).toBe(404);
    }
  });

  it("keeps the dashboard and projects for an organization with no optional module", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await entitle([]);

    expect((await request(app).get("/api/projects").set(auth)).status).toBe(200);
    expect((await request(app).get("/api/summary").set(auth)).status).not.toBe(404);
  });

  it("leaves an enabled module working beside a disabled one", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    await entitle(["REPORTS"]);

    expect((await request(app).get("/api/reports").set(auth)).status).toBe(200);
    expect((await request(app).get("/api/crm/boards").set(auth)).status).toBe(404);
  });

  it("answers each organization by its own modules", async () => {
    const insider = await signInAs("Insider", { role: "ADMIN" });
    const outsider = await signInAsOutsider("Globex");
    await entitle(["TASKS", "REPORTS"], outsider.org.id);

    expect((await request(app).get("/api/crm/boards").set(insider.auth)).status).toBe(200);
    expect((await request(app).get("/api/crm/boards").set(outsider.auth)).status).toBe(404);
  });
});

describe("the session names the enabled modules", () => {
  it("lists dashboard, projects and the optional modules the organization has", async () => {
    const { auth } = await signInAs("Member", { role: "MANAGER" });
    await entitle(["TASKS"]);

    const res = await request(app).get("/api/auth/me").set(auth);
    expect(res.body.modules).toEqual(["DASHBOARD", "PROJECTS", "TASKS"]);
  });
});

describe("changing the module set", () => {
  it("applies to the organization's next request", async () => {
    const platform = await signInAsPlatformAdmin();
    const member = await signInAs("Admin", { role: "ADMIN" });
    const org = await currentOrg();

    await request(app).patch(`/api/platform/organizations/${org.id}`).set(platform.auth)
      .send({ modules: ["CRM", "REPORTS"] });
    expect((await request(app).get("/api/tasks").set(member.auth)).status).toBe(404);

    await request(app).patch(`/api/platform/organizations/${org.id}`).set(platform.auth)
      .send({ modules: ["CRM", "TASKS", "REPORTS"] });
    expect((await request(app).get("/api/tasks").set(member.auth)).status).toBe(200);
  });

  it("hides a removed module's data and restores it unchanged", async () => {
    const platform = await signInAsPlatformAdmin();
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(user.id);
    const org = await currentOrg();
    const created = await request(app).post("/api/tasks").set(auth)
      .send({ projectId, title: "Write the brief", priority: "MEDIUM" });
    expect(created.status).toBe(201);

    await request(app).patch(`/api/platform/organizations/${org.id}`).set(platform.auth)
      .send({ modules: ["CRM", "REPORTS"] });
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(auth)).status).toBe(404);
    expect(await prisma.task.count()).toBe(1);

    await request(app).patch(`/api/platform/organizations/${org.id}`).set(platform.auth)
      .send({ modules: ["CRM", "TASKS", "REPORTS"] });
    const restored = await request(app).get(`/api/tasks/${created.body.id}`).set(auth);
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ id: created.body.id, title: "Write the brief" });
  });
});
