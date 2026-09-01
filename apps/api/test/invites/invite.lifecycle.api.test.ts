import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

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

    // Unauthenticated: the visitor following the link has no session yet.
    const resolved = await request(app).get(`/api/regustration/${code}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body).toEqual({ registrationType: "EMPLOYEE" });

    expect((await request(app).delete(`/api/invites/${id}`).set(admin)).status).toBe(204);

    expect((await request(app).get("/api/invites").set(admin)).body).toEqual([]);
    // Gone from the list, still in the database: revocation is how an
    // invitation stops working, not how its record is erased.
    const stored = await prisma.invite.findUniqueOrThrow({ where: { id } });
    expect(stored.revokedAt).toBeInstanceOf(Date);
    expect(stored.role).toBe("GUEST");
    expect(await prisma.inviteProject.count({ where: { inviteId: id } })).toBe(1);

    // And the link stops resolving, the same way an unknown one does not.
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
    // Only the form to show. Organization, creator, role, projects, address and
    // status would each tell a stranger something about the agency.
    expect(resolved.body).toEqual({ registrationType: "CLIENT" });
  });

  it("cannot be redeemed through employee registration, and survives the attempt", async () => {
    const created = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT" });

    const registered = await request(app).post("/api/auth/register").send({
      name: "Customer", email: "customer@acme.com", password: "hunter2hunter2",
      inviteCode: created.body.code,
    });

    expect(registered.status).toBe(403);
    // Not consumed: client registration will need this same link when it lands.
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
