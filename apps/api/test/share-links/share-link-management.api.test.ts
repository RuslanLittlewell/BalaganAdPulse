import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Role } from "@adpulse/access-policy";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

type Auth = { Authorization: string };

let admin: Auth;
let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs("Admin", { role: "ADMIN" });
  admin = signedIn.auth;
  ({ clientId, projectId } = await seedProject(signedIn.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

const linkOf = (id = projectId) => `/api/projects/${id}/share-link`;
const issue = (body: unknown = {}, auth: Auth = admin, id = projectId) =>
  request(app).put(linkOf(id)).set(auth).send(body as object);

const memberWith = async (role: Role) => {
  const member = await signInAs(role, { role });
  await grantAccess(member.membership!.id, clientId);
  return member.auth;
};

describe("a project's share link", () => {
  it("does not exist until an admin creates it", async () => {
    const res = await request(app).get(linkOf()).set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("is created by an admin with a random token of 43 characters", async () => {
    const res = await issue();

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(res.body.createdAt).getTime()).not.toBeNaN();
  });

  it("is shown again with the same address whenever the admin reads it", async () => {
    const { token } = (await issue()).body;

    expect((await request(app).get(linkOf()).set(admin)).body.token).toBe(token);
  });

  it("stays one link when an admin asks to create it again", async () => {
    const { token } = (await issue()).body;

    const again = await issue();

    expect(again.status).toBe(200);
    expect(again.body.token).toBe(token);
    expect(await prisma.projectShareLink.count({ where: { projectId } })).toBe(1);
  });

  it("gets a new token when the admin replaces it", async () => {
    const { token } = (await issue()).body;

    const renewed = await issue({ renew: true });

    expect(renewed.status).toBe(200);
    expect(renewed.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(renewed.body.token).not.toBe(token);
    expect((await request(app).get(linkOf()).set(admin)).body.token).toBe(renewed.body.token);
  });

  it("is created by a replacement request when the project has none", async () => {
    expect((await issue({ renew: true })).status).toBe(201);
  });

  it("is switched off by the admin, leaving the project without one", async () => {
    await issue();

    expect((await request(app).delete(linkOf()).set(admin)).status).toBe(204);
    expect((await request(app).get(linkOf()).set(admin)).body).toBeNull();
    expect((await request(app).delete(linkOf()).set(admin)).status).toBe(404);
  });

  it("refuses a body that is not a yes or no to renewing", async () => {
    expect((await issue({ renew: "yes" })).status).toBe(400);
    expect((await issue({ extra: true })).status).toBe(400);
  });

  it("is refused to every role but an admin, even when they reach the project", async () => {
    await issue();
    for (const role of ["MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"] as const) {
      const auth = await memberWith(role);

      expect((await request(app).get(linkOf()).set(auth)).status, `${role} read`).toBe(403);
      expect((await issue({}, auth)).status, `${role} create`).toBe(403);
      expect((await issue({ renew: true }, auth)).status, `${role} replace`).toBe(403);
      expect((await request(app).delete(linkOf()).set(auth)).status, `${role} remove`).toBe(403);
    }
    expect(await prisma.projectShareLink.count()).toBe(1);
  });

  it("answers 404 to an admin of another organization", async () => {
    const outsider = await signInAsOutsider();

    expect((await request(app).get(linkOf()).set(outsider.auth)).status).toBe(404);
    expect((await issue({}, outsider.auth)).status).toBe(404);
    expect((await request(app).delete(linkOf()).set(outsider.auth)).status).toBe(404);
  });

  it("goes with its project when the project is deleted", async () => {
    await issue();

    await request(app).delete(`/api/projects/${projectId}`).set(admin).expect(204);

    expect(await prisma.projectShareLink.count()).toBe(0);
  });

  it("is recorded in the audit trail without its token", async () => {
    const { token } = (await issue()).body;
    const renewed = (await issue({ renew: true })).body.token;
    await request(app).delete(linkOf()).set(admin);

    const events = await prisma.auditEvent.findMany({
      where: { entityType: "project", entityId: projectId }, orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => event.changes)).toEqual([
      { shareLink: "created" }, { shareLink: "replaced" }, { shareLink: "removed" },
    ]);
    expect(events.every((event) => event.action === "UPDATE" && event.projectId === projectId)).toBe(true);
    const written = JSON.stringify(events);
    expect(written).not.toContain(token);
    expect(written).not.toContain(renewed);
  });

  it("writes nothing to the audit trail when an existing link is only read back", async () => {
    await issue();
    await issue();

    expect(await prisma.auditEvent.count({ where: { entityType: "project", entityId: projectId } })).toBe(1);
  });
});
