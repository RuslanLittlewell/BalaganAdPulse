import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

const app = createApp();

let admin: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  ({ auth: admin } = await signInAs("Admin", { role: "ADMIN" }));
  ({ projectId } = await seedProject("unused", "Invite project"));
});
afterAll(async () => { await prisma.$disconnect(); });

describe("an employee invitation end to end", () => {
  it("is created, listed, resolved publicly, revoked, and then kept only as history", async () => {
    const created = await request(app).post("/api/invites").set(admin).send({
      registrationType: "EMPLOYEE", role: "GUEST", projectIds: [projectId],
    });
    expect(created.status).toBe(201);
    const { id, code } = created.body;
    expect(created.body.registrationUrl).toBe(`/regustration/${code}`);

    const listed = await request(app).get("/api/invites?registrationType=EMPLOYEE").set(admin);
    expect(listed.body.map((invite: { id: string }) => invite.id)).toEqual([id]);

    const resolved = await request(app).get(`/api/regustration/${code}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body).toEqual({ registrationType: "EMPLOYEE" });

    expect((await request(app).delete(`/api/invites/${id}`).set(admin)).status).toBe(204);

    expect((await request(app).get("/api/invites").set(admin)).body).toEqual([]);
    const stored = await prisma.invite.findUniqueOrThrow({ where: { id } });
    expect(stored.revokedAt).toBeInstanceOf(Date);
    expect(stored.role).toBe("GUEST");
    expect(await prisma.inviteProject.count({ where: { inviteId: id } })).toBe(1);

    const afterRevoke = await request(app).get(`/api/regustration/${code}`);
    expect(afterRevoke.status).toBe(404);
  });

  it("grants the invited member reach over exactly the projects it named", async () => {
    const second = await seedProject("unused", "Second project");
    const created = await request(app).post("/api/invites").set(admin).send({
      registrationType: "EMPLOYEE", role: "MANAGER", projectIds: [projectId],
    });

    const registered = await request(app).post("/api/auth/register").send({
      name: "Newcomer", email: "newcomer@acme.com", password: "hunter2hunter2",
      inviteCode: created.body.code,
    });
    expect(registered.status).toBe(201);

    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email: "newcomer@acme.com" } },
    });
    expect(membership.role).toBe("MANAGER");
    const grants = await prisma.clientAccess.findMany({ where: { membershipId: membership.id } });
    expect(grants.map((grant) => grant.projectId)).toEqual([projectId]);
    expect(grants.map((grant) => grant.projectId)).not.toContain(second.projectId);
  });
});

describe("a client invitation end to end", () => {
  it("is created and resolves as a client form, carrying no employee detail", async () => {
    const created = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ registrationType: "CLIENT", role: null, projectIds: [] });

    const resolved = await request(app).get(`/api/regustration/${created.body.code}`);

    expect(resolved.status).toBe(200);
    expect(resolved.body).toEqual({ registrationType: "CLIENT" });
  });

  it("cannot be redeemed as an employee would be, and survives the attempt", async () => {
    const created = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT" });

    const registered = await request(app).post("/api/auth/register").send({
      name: "Customer", email: "customer@acme.com", password: "hunter2hunter2",
      inviteCode: created.body.code,
    });

    expect(registered.status).toBe(400);
    const stored = await prisma.invite.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stored.usedAt).toBeNull();
    expect(await prisma.user.count({ where: { email: "customer@acme.com" } })).toBe(0);
  });

  it("is listed apart from employee invitations", async () => {
    await request(app).post("/api/invites").set(admin).send({ registrationType: "CLIENT" });
    await request(app).post("/api/invites").set(admin).send({
      registrationType: "EMPLOYEE", role: "GUEST", projectIds: [projectId],
    });

    const clients = await request(app).get("/api/invites?registrationType=CLIENT").set(admin);
    const employees = await request(app).get("/api/invites?registrationType=EMPLOYEE").set(admin);

    expect(clients.body).toHaveLength(1);
    expect(clients.body[0].registrationType).toBe("CLIENT");
    expect(employees.body).toHaveLength(1);
    expect(employees.body[0].registrationType).toBe("EMPLOYEE");
    expect((await request(app).get("/api/invites").set(admin)).body).toHaveLength(2);
  });
});

describe("registering as a client", () => {
  const details = {
    client: { name: "Клиника", organization: "ООО Клиника", phone: "+375291112233" },
    project: { name: "Стоматология", niche: "Медицина" },
  };

  it("creates the account, the client and the first project together", async () => {
    const invite = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT" });

    const registered = await request(app).post("/api/auth/register").send({
      name: "Иван", email: "ivan@clinic.by", password: "hunter2hunter2",
      inviteCode: invite.body.code, ...details,
    });

    expect(registered.status).toBe(201);
    const client = await prisma.client.findFirstOrThrow({ where: { name: "Клиника" } });
    expect(client.organization).toBe("ООО Клиника");
    const project = await prisma.project.findFirstOrThrow({ where: { clientId: client.id } });
    expect(project.name).toBe("Стоматология");
  });

  it("gives the new member the client role and reach over that project alone", async () => {
    const invite = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT" });
    await request(app).post("/api/auth/register").send({
      name: "Иван", email: "ivan@clinic.by", password: "hunter2hunter2",
      inviteCode: invite.body.code, ...details,
    });

    const user = await prisma.user.findFirstOrThrow({ where: { email: "ivan@clinic.by" } });
    const membership = await prisma.membership.findFirstOrThrow({ where: { userId: user.id } });
    expect(membership.role).toBe("CLIENT");
    const grants = await prisma.clientAccess.findMany({ where: { membershipId: membership.id } });
    expect(grants).toHaveLength(1);
    expect(grants[0].projectId).not.toBeNull();
  });

  it("spends the invitation", async () => {
    const invite = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT" });
    await request(app).post("/api/auth/register").send({
      name: "Иван", email: "ivan@clinic.by", password: "hunter2hunter2",
      inviteCode: invite.body.code, ...details,
    });

    const stored = await prisma.invite.findUniqueOrThrow({ where: { id: invite.body.id } });
    expect(stored.usedAt).not.toBeNull();
  });

  it("400s a client registration missing its project, and stores nothing", async () => {
    const invite = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT" });

    const registered = await request(app).post("/api/auth/register").send({
      name: "Иван", email: "ivan@clinic.by", password: "hunter2hunter2",
      inviteCode: invite.body.code, client: details.client,
    });

    expect(registered.status).toBe(400);
    expect(await prisma.user.count({ where: { email: "ivan@clinic.by" } })).toBe(0);
    expect(await prisma.client.count({ where: { name: "Клиника" } })).toBe(0);
    expect((await prisma.invite.findUniqueOrThrow({ where: { id: invite.body.id } })).usedAt)
      .toBeNull();
  });

  it("shows the admin the project the client made", async () => {
    const invite = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT" });
    await request(app).post("/api/auth/register").send({
      name: "Иван", email: "ivan@clinic.by", password: "hunter2hunter2",
      inviteCode: invite.body.code, ...details,
    });

    const projects = await request(app).get("/api/projects").set(admin);
    expect(projects.body.map((project: { name: string }) => project.name))
      .toContain("Стоматология");
  });

  it("shows the admin a task the client raised on it", async () => {
    const invite = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT" });
    const registered = await request(app).post("/api/auth/register").send({
      name: "Иван", email: "ivan@clinic.by", password: "hunter2hunter2",
      inviteCode: invite.body.code, ...details,
    });
    const asClient = { Authorization: `Bearer ${registered.body.accessToken}` };
    const project = await prisma.project.findFirstOrThrow({ where: { name: "Стоматология" } });

    const raised = await request(app).post("/api/tasks").set(asClient)
      .send({ projectId: project.id, title: "Поменяйте баннер", priority: "HIGH" });
    expect(raised.status).toBe(201);

    const board = await request(app).get("/api/tasks").set(admin);
    expect(board.body.map((task: { title: string }) => task.title)).toContain("Поменяйте баннер");
  });
});

describe("an invitation to join an existing client", () => {
  it("resolves its link to the joining form", async () => {
    const client = await prisma.client.create({
      data: { name: "Клиника", orgId: (await currentOrg()).id },
    });
    const created = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT_STAFF", clientId: client.id });

    const resolved = await request(app).get(`/api/regustration/${created.body.code}`);

    expect(resolved.status).toBe(200);
    expect(resolved.body).toEqual({ registrationType: "CLIENT_STAFF" });
  });
});
