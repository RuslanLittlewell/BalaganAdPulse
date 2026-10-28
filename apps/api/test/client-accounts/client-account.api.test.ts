import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Role } from "@prisma/client";

vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));

import { createApp } from "../../src/composition/app.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

let admin: { Authorization: string };
let clientId: string;

const account = (path = "") => `/api/clients/${clientId}/account${path}`;
const signIn = (login: string, password: string) =>
  request(app).post("/api/auth/login").send({ login, password });
const bearer = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

async function created() {
  const res = await request(app).post(account()).set(admin);
  expect(res.status).toBe(201);
  return res.body as { login: string; password: string; createdAt: string };
}

async function staff(role: Role) {
  const { auth, membership } = await signInAs(role, { role });
  await grantAccess(membership!.id, clientId);
  return auth;
}

beforeEach(async () => {
  await resetDb();
  resetIdentityRateLimits();
  ({ auth: admin } = await signInAs("Admin"));
  clientId = (await request(app).post("/api/clients").set(admin).send({ name: "Клиника Здоровье" })).body.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("creating a client's cabinet access", () => {
  it("answers a login made from the name and a password that open the client's cabinet", async () => {
    const credentials = await created();

    expect(credentials.login).toMatch(/^klinika-zdorove-\d{4}@balagan\.pro$/);
    expect(credentials.password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{12}$/);

    const session = await signIn(credentials.login, credentials.password);
    expect(session.status).toBe(200);
    const me = await request(app).get("/api/auth/me").set(bearer(session.body.accessToken));
    expect(me.body).toMatchObject({
      user: { name: "Клиника Здоровье", email: null },
      role: "CLIENT_ADMIN",
      clientIds: [clientId],
    });
  });

  it("signs in whatever the letter case of the login", async () => {
    const credentials = await created();

    expect((await signIn(credentials.login.toUpperCase(), credentials.password)).status).toBe(200);
  });

  it("signs the client in by the login even when another account has it as an email", async () => {
    const credentials = await created();
    await prisma.user.create({ data: { name: "Однофамилец", email: credentials.login, passwordHash: "hash" } });

    const session = await signIn(credentials.login, credentials.password);

    expect(session.status).toBe(200);
    const me = await request(app).get("/api/auth/me").set(bearer(session.body.accessToken));
    expect(me.body).toMatchObject({ user: { name: "Клиника Здоровье", login: credentials.login }, clientIds: [clientId] });
  });

  it("sends no recovery message for a login", async () => {
    const credentials = await created();

    const res = await request(app).post("/api/auth/password-reset").send({ email: credentials.login });

    expect(res.status).toBe(202);
    expect(await prisma.passwordReset.count()).toBe(0);
  });

  it("reaches the client's projects and nothing of another client", async () => {
    const own = await request(app).post("/api/projects").set(admin).send({ name: "Сайт", clientId });
    const otherClient = await request(app).post("/api/clients").set(admin).send({ name: "Автосалон" });
    await request(app).post("/api/projects").set(admin).send({ name: "Чужой", clientId: otherClient.body.id });
    const credentials = await created();
    const session = await signIn(credentials.login, credentials.password);

    const projects = await request(app).get("/api/projects").set(bearer(session.body.accessToken));

    expect(projects.body.map((project: { id: string }) => project.id)).toEqual([own.body.id]);
  });

  it("refuses a second access for the same client", async () => {
    const first = await created();

    const again = await request(app).post(account()).set(admin);

    expect(again.status).toBe(409);
    expect((await request(app).get(account()).set(admin)).body).toMatchObject({ login: first.login, password: first.password });
  });

  it("does not find a client of another organization", async () => {
    const outsider = await signInAsOutsider();

    const res = await request(app).post(`/api/clients/${outsider.client.id}/account`).set(admin);

    expect(res.status).toBe(404);
    expect(await prisma.clientAccount.count()).toBe(0);
  });

  it("keeps neither the hash nor the kept copy readable", async () => {
    const credentials = await created();

    const user = await prisma.user.findUniqueOrThrow({ where: { login: credentials.login } });

    expect(user.email).toBeNull();
    expect(user.passwordHash).not.toContain(credentials.password);
    expect(user.issuedPassword).not.toContain(credentials.password);
  });

  it("records the access on the client without the password", async () => {
    const credentials = await created();
    await request(app).post(account("/password")).set(admin);

    const events = await prisma.auditEvent.findMany({ where: { clientId, entityType: "client" }, orderBy: { createdAt: "asc" } });

    expect(events.map((event) => [event.action, event.summary])).toEqual([
      ["CREATE", "Created client “Клиника Здоровье”"],
      ["CREATE", "Created cabinet access for client “Клиника Здоровье”"],
      ["UPDATE", "Issued a new cabinet password for client “Клиника Здоровье”"],
    ]);
    expect(JSON.stringify(events)).not.toContain(credentials.password);
  });
});

describe("reading a client's cabinet access", () => {
  it("answers the same login and password later", async () => {
    const credentials = await created();

    const res = await request(app).get(account()).set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(credentials);
  });

  it("answers null for a client without access", async () => {
    const res = await request(app).get(account()).set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe("issuing a new password", () => {
  it("keeps the login, refuses the old password and ends the old sessions", async () => {
    const first = await created();
    const session = await signIn(first.login, first.password);

    const res = await request(app).post(account("/password")).set(admin);

    expect(res.status).toBe(200);
    expect(res.body.login).toBe(first.login);
    expect(res.body.password).not.toBe(first.password);
    expect((await signIn(first.login, first.password)).status).toBe(401);
    expect((await signIn(first.login, res.body.password)).status).toBe(200);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: session.body.refreshToken })).status).toBe(401);
    expect((await request(app).get(account()).set(admin)).body.password).toBe(res.body.password);
  });

  it("answers 404 for a client without access", async () => {
    expect((await request(app).post(account("/password")).set(admin)).status).toBe(404);
  });
});

describe("the client setting a password of their own", () => {
  it("drops the kept copy until an admin issues a new one", async () => {
    const credentials = await created();
    const session = await signIn(credentials.login, credentials.password);
    const changed = await request(app).patch("/api/user/profile").set(bearer(session.body.accessToken))
      .send({ name: "Клиника Здоровье", currentPassword: credentials.password, newPassword: "own-password-1" });
    expect(changed.status).toBe(200);

    expect((await request(app).get(account()).set(admin)).body).toMatchObject({ login: credentials.login, password: null });

    const issued = await request(app).post(account("/password")).set(admin);
    expect((await request(app).get(account()).set(admin)).body.password).toBe(issued.body.password);
  });

  it("shows the login in the profile", async () => {
    const credentials = await created();
    const session = await signIn(credentials.login, credentials.password);

    const profile = await request(app).get("/api/user/profile").set(bearer(session.body.accessToken));

    expect(profile.body).toMatchObject({ email: null, login: credentials.login });
  });
});

describe("who handles cabinet access", () => {
  it.each(["MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"] as const)("refuses a %s reaching the client", async (role) => {
    await created();
    const auth = await staff(role);

    expect((await request(app).get(account()).set(auth)).status).toBe(403);
    expect((await request(app).post(account()).set(auth)).status).toBe(403);
    expect((await request(app).post(account("/password")).set(auth)).status).toBe(403);
  });

  it("answers 404 to the principal of another client", async () => {
    const other = await request(app).post("/api/clients").set(admin).send({ name: "Автосалон" });
    const { auth, membership } = await signInAs("Principal", { role: "CLIENT_ADMIN" });
    await grantAccess(membership!.id, other.body.id);

    expect((await request(app).get(account()).set(auth)).status).toBe(404);
    expect((await request(app).post(account()).set(auth)).status).toBe(404);
  });
});

describe("the account and its client", () => {
  it("stops signing in once the client is deleted", async () => {
    const credentials = await created();

    expect((await request(app).delete(`/api/clients/${clientId}`).set(admin)).status).toBe(204);

    expect((await signIn(credentials.login, credentials.password)).status).toBe(401);
  });

  it("leaves the client without access once the membership is removed", async () => {
    await created();
    const { membershipId } = await prisma.clientAccount.findUniqueOrThrow({ where: { clientId } });

    expect((await request(app).delete(`/api/members/${membershipId}`).set(admin)).status).toBe(204);

    expect((await request(app).get(account()).set(admin)).body).toBeNull();
    expect((await request(app).post(account()).set(admin)).status).toBe(201);
  });
});
