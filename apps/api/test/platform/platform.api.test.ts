import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { resetDb } from "../helpers/db.js";
import { currentOrg, signInAs, signInAsPlatformAdmin } from "../helpers/auth.js";

const app = createApp();
const ORGANIZATIONS = "/api/platform/organizations";

beforeEach(async () => { await resetDb(); resetIdentityRateLimits(); });
afterAll(async () => { await prisma.$disconnect(); });

const addOrganization = async (
  auth: { Authorization: string },
  body: Record<string, unknown> = {},
) => request(app).post(ORGANIZATIONS).set(auth).send({
  name: "Acme", modules: ["CRM", "REPORTS"], adminEmail: "owner@acme.com", ...body,
});

describe("who reaches the platform", () => {
  it("refuses a caller without a session -> 401", async () => {
    expect((await request(app).get(ORGANIZATIONS)).status).toBe(401);
  });

  it("refuses an organization admin -> 403", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    expect((await request(app).get(ORGANIZATIONS).set(auth)).status).toBe(403);
    expect((await addOrganization(auth)).status).toBe(403);
    expect(await prisma.organization.count()).toBe(1);
  });

  it("refuses an account with no membership that is not the platform administrator -> 403", async () => {
    const { auth } = await signInAs("Stranger", { membership: false });
    expect((await request(app).get(ORGANIZATIONS).set(auth)).status).toBe(403);
  });

  it("serves the platform administrator", async () => {
    const { auth } = await signInAsPlatformAdmin();
    expect((await request(app).get(ORGANIZATIONS).set(auth)).status).toBe(200);
  });

  it("answers an unknown platform path with 404 for the administrator", async () => {
    const { auth } = await signInAsPlatformAdmin();
    expect((await request(app).get("/api/platform/nothing").set(auth)).status).toBe(404);
  });

  it("refuses the platform administrator every organization endpoint -> 403", async () => {
    const { auth } = await signInAsPlatformAdmin();
    for (const path of ["/api/projects", "/api/clients", "/api/tasks", "/api/crm/boards", "/api/members"]) {
      expect((await request(app).get(path).set(auth)).status, path).toBe(403);
    }
  });
});

describe("the platform administrator's session", () => {
  it("marks them as the platform administrator and names no organization", async () => {
    const { auth, user } = await signInAsPlatformAdmin("Owner");
    const res = await request(app).get("/api/auth/me").set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: user.id, name: "Owner", email: user.email, image: null },
      platformAdmin: true,
      organization: null,
      role: null,
      clientIds: [],
      modules: [],
    });
  });

  it("describes a member as no platform administrator, with their organization's modules", async () => {
    const { auth } = await signInAs("Member", { role: "MANAGER" });
    const res = await request(app).get("/api/auth/me").set(auth);

    expect(res.body.platformAdmin).toBe(false);
    expect(res.body.organization.status).toBe("ACTIVE");
    expect(res.body.modules).toEqual(["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"]);
  });
});

describe("listing organizations", () => {
  it("lists the existing organization with every module and its active members", async () => {
    const { auth } = await signInAsPlatformAdmin();
    await signInAs("One");
    await signInAs("Two", { role: "MANAGER" });
    await signInAs("Dormant", { status: "SUSPENDED" });
    const org = await currentOrg();

    const res = await request(app).get(ORGANIZATIONS).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: "ACTIVE",
      modules: ["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"],
      activeMembers: 2,
      createdAt: expect.any(String),
      firstAdmin: null,
    }]);
  });

  it("lists a freshly added organization last, with no members and a pending first admin", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const created = await addOrganization(auth);

    const res = await request(app).get(ORGANIZATIONS).set(auth);

    expect(res.body).toHaveLength(2);
    expect(res.body[1]).toMatchObject({
      name: "Acme",
      activeMembers: 0,
      firstAdmin: {
        email: "owner@acme.com",
        state: "PENDING",
        registrationUrl: created.body.registrationUrl,
      },
    });
  });

  it("shows a suspended organization as suspended", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const org = await currentOrg();
    await prisma.organization.update({ where: { id: org.id }, data: { status: "SUSPENDED" } });

    const res = await request(app).get(ORGANIZATIONS).set(auth);
    expect(res.body[0].status).toBe("SUSPENDED");
  });
});

describe("adding an organization", () => {
  it("stores it with dashboard, projects and the chosen modules, and an admin invitation for the email", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const res = await addOrganization(auth);

    expect(res.status).toBe(201);
    expect(res.body.organization).toMatchObject({
      name: "Acme",
      slug: "acme",
      status: "ACTIVE",
      modules: ["DASHBOARD", "PROJECTS", "CRM", "REPORTS"],
      activeMembers: 0,
    });
    expect(res.body.registrationUrl).toMatch(/^\/regustration\/[23456789A-HJ-NP-Z]{8}$/);

    const stored = await prisma.organization.findUniqueOrThrow({
      where: { id: res.body.organization.id },
      include: { invites: true },
    });
    expect(stored.modules).toEqual(["CRM", "REPORTS"]);
    expect(stored.invites).toHaveLength(1);
    expect(stored.invites[0]).toMatchObject({
      registrationType: "EMPLOYEE",
      role: "ADMIN",
      email: "owner@acme.com",
      createdById: null,
      expiresAt: null,
    });
    expect(res.body.registrationUrl).toBe(`/regustration/${stored.invites[0]!.code}`);
  });

  it("enrols the invited person as an admin of the new organization and of no other", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const created = await addOrganization(auth);
    const code = created.body.registrationUrl.split("/").pop();

    expect((await request(app).get(`/api/regustration/${code}`)).body)
      .toEqual({ registrationType: "EMPLOYEE", email: "owner@acme.com" });
    const registered = await request(app).post("/api/auth/register").send({
      name: "Owner", email: "owner@acme.com", password: "hunter2hunter2", inviteCode: code,
    });

    expect(registered.status).toBe(201);
    const memberships = await prisma.membership.findMany({ where: { user: { email: "owner@acme.com" } } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      orgId: created.body.organization.id, role: "ADMIN", status: "ACTIVE",
    });

    const listed = await request(app).get(ORGANIZATIONS).set(auth);
    expect(listed.body[1]).toMatchObject({
      activeMembers: 1,
      firstAdmin: { email: "owner@acme.com", state: "ACCEPTED", registrationUrl: null },
    });
  });

  it("refuses the invitation to any other email", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const created = await addOrganization(auth);
    const code = created.body.registrationUrl.split("/").pop();

    const res = await request(app).post("/api/auth/register").send({
      name: "Intruder", email: "intruder@acme.com", password: "hunter2hunter2", inviteCode: code,
    });
    expect(res.status).toBe(403);
  });

  it("enables only dashboard and projects when no optional module is chosen", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const res = await addOrganization(auth, { modules: [] });
    expect(res.body.organization.modules).toEqual(["DASHBOARD", "PROJECTS"]);
  });

  it("gives a second organization of the same name a distinct slug", async () => {
    const { auth } = await signInAsPlatformAdmin();
    await addOrganization(auth);
    const second = await addOrganization(auth, { adminEmail: "other@acme.com" });
    const third = await addOrganization(auth, { adminEmail: "third@acme.com" });

    expect(second.status).toBe(201);
    expect(second.body.organization.slug).toBe("acme-2");
    expect(third.body.organization.slug).toBe("acme-3");
  });

  it("derives a latin slug from a Cyrillic name", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const res = await addOrganization(auth, { name: "Балаган Медиа" });
    expect(res.body.organization).toMatchObject({ name: "Балаган Медиа", slug: "balagan-media" });
  });

  it.each([
    ["an unknown module", { modules: ["BILLING"] }],
    ["the dashboard as optional", { modules: ["DASHBOARD"] }],
    ["projects as optional", { modules: ["PROJECTS"] }],
    ["an invalid email", { adminEmail: "not-an-email" }],
    ["an empty name", { name: "   " }],
    ["a missing email", { adminEmail: undefined }],
  ])("refuses %s -> 400 and stores nothing", async (_label, body) => {
    const { auth } = await signInAsPlatformAdmin();
    const res = await addOrganization(auth, body);

    expect(res.status).toBe(400);
    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.invite.count()).toBe(0);
  });

  it("refuses an email that already has an account -> 409", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const member = await signInAs("Member");

    const res = await addOrganization(auth, { adminEmail: member.user.email });

    expect(res.status).toBe(409);
    expect(await prisma.organization.count()).toBe(1);
  });
});

describe("editing an organization", () => {
  const patch = (auth: { Authorization: string }, id: string, body: Record<string, unknown>) =>
    request(app).patch(`${ORGANIZATIONS}/${id}`).set(auth).send(body);

  it("renames it and keeps its slug", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const { body } = await addOrganization(auth);

    const res = await patch(auth, body.organization.id, { name: "Acme Ltd" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Acme Ltd", slug: "acme" });
  });

  it("adds and removes optional modules", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const { body } = await addOrganization(auth);

    const added = await patch(auth, body.organization.id, { modules: ["CRM", "REPORTS", "TASKS"] });
    expect(added.body.modules).toEqual(["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"]);

    const removed = await patch(auth, body.organization.id, { modules: ["TASKS"] });
    expect(removed.body.modules).toEqual(["DASHBOARD", "PROJECTS", "TASKS"]);
  });

  it("suspends and reactivates it", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const org = await currentOrg();

    expect((await patch(auth, org.id, { status: "SUSPENDED" })).body.status).toBe("SUSPENDED");
    expect((await patch(auth, org.id, { status: "ACTIVE" })).body.status).toBe("ACTIVE");
  });

  it("leaves what the request does not name unchanged", async () => {
    const { auth } = await signInAsPlatformAdmin();
    const { body } = await addOrganization(auth);

    const res = await patch(auth, body.organization.id, { status: "SUSPENDED" });
    expect(res.body).toMatchObject({
      name: "Acme", modules: ["DASHBOARD", "PROJECTS", "CRM", "REPORTS"], status: "SUSPENDED",
    });
  });

  it.each([
    ["an unknown module", { modules: ["BILLING"] }],
    ["projects as optional", { modules: ["PROJECTS"] }],
    ["an unknown status", { status: "CLOSED" }],
    ["an empty name", { name: "" }],
    ["the slug", { slug: "elsewhere" }],
  ])("refuses %s -> 400 and changes nothing", async (_label, change) => {
    const { auth } = await signInAsPlatformAdmin();
    const org = await currentOrg();

    expect((await patch(auth, org.id, change)).status).toBe(400);
    expect(await prisma.organization.findUniqueOrThrow({ where: { id: org.id } })).toMatchObject({
      name: org.name, slug: org.slug, status: "ACTIVE", modules: ["CRM", "TASKS", "REPORTS"],
    });
  });

  it("answers an unknown organization with 404", async () => {
    const { auth } = await signInAsPlatformAdmin();
    expect((await patch(auth, "00000000-0000-0000-0000-000000000000", { name: "X" })).status).toBe(404);
    expect((await patch(auth, "not-a-uuid", { name: "X" })).status).toBe(404);
  });

  it("refuses an organization admin -> 403", async () => {
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    const org = await currentOrg();

    expect((await patch(auth, org.id, { status: "SUSPENDED" })).status).toBe(403);
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.id } })).status).toBe("ACTIVE");
  });
});
