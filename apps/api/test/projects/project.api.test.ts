import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";
import { expectAudit } from "../helpers/audit.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let auth: { Authorization: string };
let clientId: string;

async function project(body: Record<string, unknown> = {}) {
  return request(app).post("/api/projects").set(auth)
    .send({ clientId, name: "Летний запуск", ...body });
}

beforeEach(async () => {
  await resetDb();
  ({ auth } = await signInAs());
  const client = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
  clientId = client.body.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Projects API", () => {
  it("creates a project bound to a client (201)", async () => {
    const res = await project({ budgetCurrency: "USD" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ clientId, name: "Летний запуск", budgetCurrency: "USD" });
    await expectAudit({ action: "CREATE", entityType: "project", entityId: res.body.id, clientId, projectId: res.body.id });
  });

  it("refuses a project without a client", async () => {
    const res = await request(app).post("/api/projects").set(auth).send({ name: "Без клиента" });
    expect(res.status).toBe(400);
  });

  it("refuses a project on a client the caller does not own", async () => {
    const res = await project({ clientId: MISSING });
    expect(res.status).toBe(404);
  });

  it("starts with no campaigns: they come from the connected accounts", async () => {
    const created = await project();
    const res = await request(app)
      .get(`/api/projects/${created.body.id}/campaigns?from=2026-08-01&to=2026-08-31`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("creating a client alone seeds nothing: work starts with a project", async () => {
    const client = await request(app).post("/api/clients").set(auth).send({ name: "Bare" });
    const projects = await request(app)
      .get(`/api/projects?clientId=${client.body.id}`).set(auth);

    expect(projects.body).toHaveLength(0);
  });

  it("lists every project, and narrows to one client on request", async () => {
    await project({ name: "A" });
    const second = await request(app).post("/api/clients").set(auth).send({ name: "Other" });
    await request(app).post("/api/projects").set(auth)
      .send({ clientId: second.body.id, name: "B" });

    const all = await request(app).get("/api/projects").set(auth);
    const narrowed = await request(app).get(`/api/projects?clientId=${clientId}`).set(auth);

    expect(all.body).toHaveLength(2);
    expect(narrowed.body.map((p: { name: string }) => p.name)).toEqual(["A"]);
  });

  it("numbers a client's projects in the order they were added", async () => {
    const first = await project({ name: "A" });
    const second = await project({ name: "B" });
    expect(first.body.position).toBe(0);
    expect(second.body.position).toBe(1);
  });

  it("updates a project", async () => {
    const created = await project();
    const res = await request(app).patch(`/api/projects/${created.body.id}`).set(auth)
      .send({ name: "Осенний запуск", budgetCurrency: "EUR" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Осенний запуск", budgetCurrency: "EUR" });
    await expectAudit({ action: "UPDATE", entityType: "project", entityId: created.body.id, clientId, projectId: created.body.id });
  });

  it("deletes a project and its sheets", async () => {
    const created = await project();
    const res = await request(app).delete(`/api/projects/${created.body.id}`).set(auth);

    expect(res.status).toBe(204);
    expect(await prisma.campaign.count({ where: { projectId: created.body.id } })).toBe(0);
    await expectAudit({ action: "DELETE", entityType: "project", entityId: created.body.id, clientId, projectId: created.body.id });
  });

  it("hides another owner's project behind the same 404", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const theirClient = await request(app).post("/api/clients").set(other.auth).send({ name: "T" });
    const theirs = await request(app).post("/api/projects").set(other.auth)
      .send({ clientId: theirClient.body.id, name: "Theirs" });

    const res = await request(app).get(`/api/projects/${theirs.body.id}`).set(stranger.auth);
    expect(res.status).toBe(404);
  });

  it("hands the logo back inside the project, in the list and on its own", async () => {
    const PNG = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const created = await project();
    const put = await request(app).put(`/api/projects/${created.body.id}/avatar`).set(auth)
      .field("avatarPath", JSON.stringify({ source: "upload" }))
      .attach("image", PNG, { filename: "logo.png", contentType: "image/png" });

    expect(put.status).toBe(200);
    expect(put.body.image).toMatch(/^data:image\/png;base64,/);
    await expectAudit({ action: "UPDATE", entityType: "project", entityId: created.body.id, clientId, projectId: created.body.id });

    const one = await request(app).get(`/api/projects/${created.body.id}`).set(auth);
    const list = await request(app).get("/api/projects").set(auth);
    expect(one.body.image).toMatch(/^data:image\/png;base64,/);
    expect(list.body[0].image).toMatch(/^data:image\/png;base64,/);
  });

  it("reports no logo before one is uploaded", async () => {
    const created = await project();
    expect(created.body.image).toBeNull();
  });

  it("answers 404 for the avatar endpoint that no longer exists", async () => {
    const created = await project();
    const res = await request(app).get(`/api/projects/${created.body.id}/avatar`).set(auth);
    expect(res.status).toBe(404);
  });

  it("starts a project at NEW, so a fresh one is marked as such", async () => {
    const res = await project();
    expect(res.body.priority).toBe("NEW");
  });

  it("takes a priority on creation", async () => {
    const res = await project({ priority: "CRITICAL" });
    expect(res.status).toBe(201);
    expect(res.body.priority).toBe("CRITICAL");
  });

  it("changes the priority on its own, without touching the rest", async () => {
    const created = await project({ budgetCurrency: "USD" });
    const res = await request(app).patch(`/api/projects/${created.body.id}`).set(auth)
      .send({ priority: "URGENT" });

    expect(res.status).toBe(200);
    expect(res.body.priority).toBe("URGENT");
    expect(res.body).toMatchObject({ budgetCurrency: "USD", name: "Летний запуск" });
  });

  it("accepts every priority the interface offers", async () => {
    for (const priority of ["CRITICAL", "URGENT", "WAITING", "IDLE", "NEW"]) {
      const created = await project({ priority });
      expect(created.body.priority, priority).toBe(priority);
    }
  });

  it("refuses a priority it does not know", async () => {
    const res = await project({ priority: "MAGENTA" });
    expect(res.status).toBe(400);
  });

  it("carries the priority in the list", async () => {
    await project({ priority: "WAITING" });
    const res = await request(app).get("/api/projects").set(auth);
    expect(res.body[0].priority).toBe("WAITING");
  });

  describe("role permissions and grant scoping", () => {
    it("lets a guest read but never write", async () => {
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
      const guest = await signInAs("Guest", { role: "GUEST" });
      await grantAccess(guest.membership!.id, clientId);

      expect((await request(app).get(`/api/projects/${projectId}`).set(guest.auth)).status).toBe(200);
      expect((await request(app).post("/api/projects").set(guest.auth).send({ clientId, name: "No" })).status).toBe(403);
      expect((await request(app).patch(`/api/projects/${projectId}`).set(guest.auth).send({ name: "No" })).status).toBe(403);
      expect((await request(app).delete(`/api/projects/${projectId}`).set(guest.auth)).status).toBe(403);
    });

    it("lets a manager create and edit but never delete", async () => {
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await grantAccess(manager.membership!.id, clientId);

      expect((await request(app).patch(`/api/projects/${projectId}`).set(manager.auth).send({ name: "Renamed" })).status).toBe(200);
      expect((await request(app).delete(`/api/projects/${projectId}`).set(manager.auth)).status).toBe(403);
    });

    it("narrows a project-scoped grant to that project alone", async () => {
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
      const second = await prisma.project.create({
        data: { clientId, name: "Second", position: 1 },
      });
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await grantAccess(manager.membership!.id, clientId, projectId);

      const listed = await request(app).get("/api/projects").set(manager.auth);
      expect(listed.body.map((p: { id: string }) => p.id)).toEqual([projectId]);
      expect((await request(app).get(`/api/projects/${second.id}`).set(manager.auth)).status).toBe(404);
    });

    it("refuses creating a project under a client out of reach -> 404", async () => {
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const { clientId } = await seedProject(admin.user.id, "Acme");
      const manager = await signInAs("Manager", { role: "MANAGER" });

      const res = await request(app).post("/api/projects").set(manager.auth).send({ clientId, name: "Mine" });
      expect(res.status).toBe(404);
    });
  });
});

describe("the currency a project's figures are stated in", () => {
  it("stores the currency named on creation", async () => {
    const created = await request(app).post("/api/projects").set(auth)
      .send({ clientId, name: "Стоматология", budgetCurrency: "USD" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ budgetCurrency: "USD" });
  });

  it("defaults to the agency's own currency", async () => {
    const created = await request(app).post("/api/projects").set(auth)
      .send({ clientId, name: "Без валюты" });

    expect(created.body.budgetCurrency).toBe("BYN");
  });

  it("changes the currency without touching the rest", async () => {
    const created = await request(app).post("/api/projects").set(auth)
      .send({ clientId, name: "П" });

    const updated = await request(app).patch(`/api/projects/${created.body.id}`).set(auth)
      .send({ budgetCurrency: "EUR" });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: "П", budgetCurrency: "EUR" });
  });

  it("400s a currency outside the four", async () => {
    const created = await request(app).post("/api/projects").set(auth)
      .send({ clientId, name: "П", budgetCurrency: "GBP" });

    expect(created.status).toBe(400);
  });
});

describe("assigning staff while creating a project", () => {
  async function employee(name: string, role: "MANAGER" | "GUEST" | "ADMIN" | "CLIENT" = "MANAGER", status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
    const signedIn = await signInAs(name, { role, status });
    return { id: signedIn.membership!.id, auth: signedIn.auth };
  }

  async function nothingStored() {
    expect(await prisma.project.count()).toBe(0);
    expect(await prisma.clientAccess.count()).toBe(0);
  }

  it("lets each named employee reach the new project", async () => {
    const first = await employee("First");
    const second = await employee("Second", "GUEST");

    const created = await project({ memberIds: [first.id, second.id] });

    expect(created.status).toBe(201);
    for (const one of [first, second]) {
      const listed = await request(app).get("/api/projects").set(one.auth);
      expect(listed.body.map((p: { id: string }) => p.id)).toEqual([created.body.id]);
    }
  });

  it("grants that project alone, not the rest of its client", async () => {
    const existing = await project({ name: "Старый" });
    const staff = await employee("Staff");

    const created = await project({ memberIds: [staff.id] });

    const listed = await request(app).get(`/api/projects?clientId=${clientId}`).set(staff.auth);
    expect(listed.body.map((p: { id: string }) => p.id)).toEqual([created.body.id]);
    expect(listed.body.map((p: { id: string }) => p.id)).not.toContain(existing.body.id);
  });

  it("refuses a manager who names an employee, storing nothing", async () => {
    const lead = await employee("Lead");
    await grantAccess(lead.id, clientId);
    const other = await employee("Other");

    const res = await request(app).post("/api/projects").set(lead.auth)
      .send({ clientId, name: "Чужой", memberIds: [other.id] });

    expect(res.status).toBe(403);
    expect(await prisma.project.count()).toBe(0);
    expect(await prisma.clientAccess.count({ where: { membershipId: other.id } })).toBe(0);
  });

  it.each([
    ["an admin", () => employee("Boss", "ADMIN")],
    ["a client", () => employee("Customer", "CLIENT")],
    ["a suspended manager", () => employee("Away", "MANAGER", "SUSPENDED")],
    ["a member of another organization", async () => ({ id: (await signInAsOutsider()).membership.id })],
  ])("refuses naming %s, storing nothing", async (_label, make) => {
    const staff = await employee("Staff");
    const ineligible = await make();

    const res = await project({ memberIds: [staff.id, ineligible.id] });

    expect(res.status).toBe(400);
    await nothingStored();
  });

  it("refuses an id that is not a uuid", async () => {
    const res = await project({ memberIds: ["nobody"] });
    expect(res.status).toBe(400);
    await nothingStored();
  });
});
