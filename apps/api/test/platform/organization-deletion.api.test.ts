import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs, signInAsOutsider, signInAsPlatformAdmin } from "../helpers/auth.js";

const app = createApp();
const ORGANIZATIONS = "/api/platform/organizations";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

async function populatedOutsider() {
  const outsider = await signInAsOutsider("Globex");
  const project = await prisma.project.create({
    data: { clientId: outsider.client.id, name: "Launch", position: 0 },
  });
  const task = await request(app).post("/api/tasks").set(outsider.auth)
    .send({ projectId: project.id, title: "Brief", priority: "MEDIUM" });
  const lead = await request(app).post(`/api/crm/boards/${project.id}/leads`).set(outsider.auth)
    .send({ name: "Lead" });
  expect(task.status).toBe(201);
  expect(lead.status).toBe(201);
  const colleague = await prisma.user.create({
    data: { name: "Colleague", email: "colleague@globex.com", passwordHash: "x" },
  });
  await prisma.membership.create({
    data: { userId: colleague.id, orgId: outsider.org.id, role: "MANAGER" },
  });
  await prisma.invite.create({
    data: { orgId: outsider.org.id, code: "GLBXAAB2", role: "MANAGER", email: "next@globex.com" },
  });
  return { ...outsider, project, colleague };
}

describe("deleting an organization", () => {
  it("removes the organization and everything it holds", async () => {
    const platform = await signInAsPlatformAdmin();
    const globex = await populatedOutsider();

    const res = await request(app).delete(`${ORGANIZATIONS}/${globex.org.id}`).set(platform.auth);

    expect(res.status).toBe(204);
    expect(await prisma.organization.findUnique({ where: { id: globex.org.id } })).toBeNull();
    expect(await prisma.client.count({ where: { orgId: globex.org.id } })).toBe(0);
    expect(await prisma.project.count({ where: { id: globex.project.id } })).toBe(0);
    expect(await prisma.task.count({ where: { orgId: globex.org.id } })).toBe(0);
    expect(await prisma.lead.count({ where: { orgId: globex.org.id } })).toBe(0);
    expect(await prisma.invite.count({ where: { orgId: globex.org.id } })).toBe(0);
    expect(await prisma.membership.count({ where: { orgId: globex.org.id } })).toBe(0);
    const listed = await request(app).get(ORGANIZATIONS).set(platform.auth);
    expect(listed.body.map((organization: { id: string }) => organization.id)).not.toContain(globex.org.id);
  });

  it("removes its people's accounts, so they cannot sign in and can be invited again", async () => {
    const platform = await signInAsPlatformAdmin();
    const globex = await populatedOutsider();

    await request(app).delete(`${ORGANIZATIONS}/${globex.org.id}`).set(platform.auth);

    expect(await prisma.user.findUnique({ where: { id: globex.user.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: globex.colleague.id } })).toBeNull();
    expect((await request(app).get("/api/auth/me").set(globex.auth)).status).toBe(401);
    const again = await request(app).post(ORGANIZATIONS).set(platform.auth)
      .send({ name: "Globex", modules: [], adminEmail: "colleague@globex.com" });
    expect(again.status).toBe(201);
  });

  it("keeps an account that also belongs to another organization", async () => {
    const platform = await signInAsPlatformAdmin();
    const globex = await populatedOutsider();
    await prisma.membership.create({
      data: { userId: globex.colleague.id, orgId: (await currentOrg()).id, role: "GUEST" },
    });

    await request(app).delete(`${ORGANIZATIONS}/${globex.org.id}`).set(platform.auth);

    expect(await prisma.user.findUnique({ where: { id: globex.colleague.id } })).not.toBeNull();
    expect(await prisma.membership.count({ where: { userId: globex.colleague.id } })).toBe(1);
  });

  it("leaves every other organization, its people and its data as they were", async () => {
    const platform = await signInAsPlatformAdmin();
    const insider = await signInAs("Insider", { role: "ADMIN" });
    const { clientId, projectId } = await seedProject(insider.user.id, "Acme");
    const globex = await populatedOutsider();

    await request(app).delete(`${ORGANIZATIONS}/${globex.org.id}`).set(platform.auth);

    expect(await prisma.organization.count()).toBe(1);
    expect((await request(app).get(`/api/clients/${clientId}`).set(insider.auth)).body)
      .toMatchObject({ name: "Acme" });
    expect((await request(app).get(`/api/projects/${projectId}`).set(insider.auth)).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: platform.user.id } })).not.toBeNull();
  });

  it("answers an unknown organization with 404", async () => {
    const platform = await signInAsPlatformAdmin();
    expect((await request(app).delete(`${ORGANIZATIONS}/00000000-0000-0000-0000-000000000000`)
      .set(platform.auth)).status).toBe(404);
    expect((await request(app).delete(`${ORGANIZATIONS}/not-a-uuid`).set(platform.auth)).status)
      .toBe(404);
  });

  it("refuses an organization admin -> 403 and deletes nothing", async () => {
    const insider = await signInAs("Admin", { role: "ADMIN" });
    const globex = await populatedOutsider();

    expect((await request(app).delete(`${ORGANIZATIONS}/${globex.org.id}`).set(insider.auth)).status)
      .toBe(403);
    expect((await request(app).delete(`${ORGANIZATIONS}/${globex.org.id}`).set(globex.auth)).status)
      .toBe(403);
    expect(await prisma.organization.findUnique({ where: { id: globex.org.id } })).not.toBeNull();
  });
});
