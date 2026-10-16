import { readFile } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let manager: SignedIn;
let colleague: SignedIn;
let guest: SignedIn;
let customer: SignedIn;
let clientId: string;
let projectId: string;
let otherProjectId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Admin", { role: "ADMIN" });
  ({ clientId, projectId } = await seedProject(admin.user.id, "Acme"));
  ({ projectId: otherProjectId } = await seedProject(admin.user.id, "Other"));
  manager = await signInAs("Manager", { role: "MANAGER" });
  colleague = await signInAs("Colleague", { role: "MANAGER" });
  guest = await signInAs("Guest", { role: "GUEST" });
  customer = await signInAs("Customer", { role: "CLIENT" });
  for (const member of [manager, colleague, guest, customer]) {
    await grantAccess(member.membership!.id, clientId);
  }
});
afterAll(() => prisma.$disconnect());

const idOf = (member: SignedIn) => member.membership!.id;

const create = (by: SignedIn, body: Record<string, unknown> = {}) =>
  request(app).post("/api/tasks").set(by.auth)
    .send({ projectId, title: "Созвон", priority: "MEDIUM", ...body });

const patch = (by: SignedIn, id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/tasks/${id}`).set(by.auth).send(body);

const read = (by: SignedIn, id: string) => request(app).get(`/api/tasks/${id}`).set(by.auth);

const board = async (by: SignedIn, query = "") =>
  ((await request(app).get(`/api/tasks${query}`).set(by.auth)).body as { id: string }[]).map((task) => task.id);

const sorted = (ids: string[]) => [...ids].sort();

describe("the participants of a task", () => {
  it("are everyone named on a task", async () => {
    const res = await create(manager, {
      participantIds: [idOf(manager), idOf(colleague), idOf(guest)],
    });
    expect(res.status).toBe(201);
    expect(sorted(res.body.participantIds)).toEqual(sorted([idOf(manager), idOf(colleague), idOf(guest)]));
  });

  it("may be several on a task", async () => {
    const created = await create(admin, { participantIds: [idOf(colleague)] });
    const res = await patch(admin, created.body.id, { participantIds: [idOf(manager), idOf(colleague)] });
    expect(res.status).toBe(200);
    expect(sorted(res.body.participantIds)).toEqual(sorted([idOf(manager), idOf(colleague)]));
  });

  it("are left alone by an update that names none", async () => {
    const created = await create(manager, { participantIds: [idOf(manager), idOf(colleague)] });
    const res = await patch(manager, created.body.id, { title: "Созвон по запуску" });
    expect(sorted(res.body.participantIds)).toEqual(sorted([idOf(manager), idOf(colleague)]));
  });

  it("are replaced as a whole", async () => {
    const created = await create(manager, { participantIds: [idOf(manager), idOf(colleague)] });
    const res = await patch(manager, created.body.id, { participantIds: [idOf(manager), idOf(guest)] });
    expect(sorted(res.body.participantIds)).toEqual(sorted([idOf(manager), idOf(guest)]));
  });

  it("are cleared by an empty list", async () => {
    const created = await create(manager, { participantIds: [idOf(manager), idOf(colleague)] });
    const res = await patch(manager, created.body.id, { participantIds: [] });
    expect(res.body.participantIds).toEqual([]);
  });

  it("name nobody twice -> 400", async () => {
    expect((await create(manager, { participantIds: [idOf(colleague), idOf(colleague)] })).status)
      .toBe(400);
  });

  it("are refused when they belong to another organization -> 400", async () => {
    const outsider = await signInAsOutsider();
    expect((await create(manager, { participantIds: [outsider.membership.id] })).status).toBe(400);
  });

  it("are refused when newly named while suspended -> 400", async () => {
    const suspended = await signInAs("Suspended", { role: "MANAGER", status: "SUSPENDED" });
    expect((await create(manager, { participantIds: [idOf(suspended)] })).status).toBe(400);
  });

  it("keep a member suspended after being named", async () => {
    const created = await create(admin, { participantIds: [idOf(colleague)] });
    await prisma.membership.update({ where: { id: idOf(colleague) }, data: { status: "SUSPENDED" } });

    const res = await patch(admin, created.body.id, { participantIds: [idOf(colleague), idOf(manager)] });

    expect(res.status).toBe(200);
  });

  it("include a client's person on a task about a project they reach", async () => {
    const res = await create(manager, { participantIds: [idOf(manager), idOf(customer)] });
    expect(res.status).toBe(201);
    expect(sorted(res.body.participantIds)).toEqual(sorted([idOf(manager), idOf(customer)]));
  });

  it("refuse a client's person on a task with no project -> 400", async () => {
    expect((await create(manager, { projectId: null, participantIds: [idOf(customer)] })).status)
      .toBe(400);
  });

  it("refuse moving a task away from a named client's person -> 400", async () => {
    const created = await create(admin, { participantIds: [idOf(customer)] });
    expect((await patch(admin, created.body.id, { projectId: otherProjectId })).status).toBe(400);
    expect((await read(admin, created.body.id)).body).toMatchObject({
      projectId, participantIds: [idOf(customer)],
    });
  });

  it("are named by nobody raising a task as a customer -> 403", async () => {
    expect((await create(customer, { participantIds: [idOf(manager)] })).status).toBe(403);
  });

  it("give a named guest no right to change the task -> 403", async () => {
    const created = await create(manager, { participantIds: [idOf(manager), idOf(guest)] });
    expect((await patch(guest, created.body.id, { title: "Чужое" })).status).toBe(403);
    expect((await read(manager, created.body.id)).body.title).toBe("Созвон");
  });

  it("lose a member removed from the organization, the tasks surviving", async () => {
    const first = await create(manager, { participantIds: [idOf(colleague), idOf(guest)] });
    const second = await create(manager, { participantIds: [idOf(colleague)] });

    expect((await request(app).delete(`/api/members/${idOf(colleague)}`).set(admin.auth)).status).toBe(204);

    expect((await read(admin, first.body.id)).body.participantIds).toEqual([idOf(guest)]);
    expect((await read(admin, second.body.id)).body.participantIds).toEqual([]);
  });

  it("ignore the responsible member a stale client still sends", async () => {
    const res = await create(admin, { assigneeId: idOf(colleague) });
    expect(res.status).toBe(201);
    expect(res.body.participantIds).toEqual([]);
  });
});

describe("a task given to somebody before participants existed", () => {
  it("carries that member as a participant once the migration has run", async () => {
    const org = await currentOrg();
    const task = await prisma.task.create({
      data: { projectId, orgId: org.id, title: "Старая", priority: "LOW", position: 0, assigneeId: idOf(manager) },
    });
    const migration = await readFile(
      new URL("../../prisma/migrations/20261014140000_task_participants_from_assignees/migration.sql", import.meta.url),
      "utf8",
    );

    await prisma.$executeRawUnsafe(migration);

    expect((await read(admin, task.id)).body.participantIds).toEqual([idOf(manager)]);
    expect(await board(manager)).toContain(task.id);
  });
});

describe("who sees a task", () => {
  it("shows a task to each participant on the board, by id and in the project", async () => {
    const created = await create(admin, { participantIds: [idOf(colleague), idOf(manager)] });

    for (const member of [manager, colleague]) {
      expect(await board(member)).toContain(created.body.id);
      expect((await read(member, created.body.id)).status).toBe(200);
      expect(await board(member, `?projectId=${projectId}`)).toContain(created.body.id);
    }
    expect(await board(guest)).not.toContain(created.body.id);
  });

  it("hides it again once the member is taken off the list", async () => {
    const created = await create(admin, { participantIds: [idOf(colleague), idOf(manager)] });
    await patch(admin, created.body.id, { participantIds: [idOf(colleague)] });

    expect(await board(manager)).not.toContain(created.body.id);
    expect((await read(manager, created.body.id)).status).toBe(404);
  });

  it("keeps it from a participant who cannot reach the project", async () => {
    const created = await create(admin, {
      projectId: otherProjectId, participantIds: [idOf(colleague), idOf(manager)],
    });
    expect(await board(manager)).not.toContain(created.body.id);
    expect((await read(manager, created.body.id)).status).toBe(404);
  });

  it("keeps an unmarked task from the client's person named on it", async () => {
    const created = await create(admin, { participantIds: [idOf(customer)] });
    expect((await read(customer, created.body.id)).status).toBe(404);
  });

  it("takes a task off its creator's board when only a colleague is named", async () => {
    const created = await create(manager, { participantIds: [idOf(colleague)] });
    expect(await board(manager)).not.toContain(created.body.id);
    expect(await board(colleague)).toContain(created.body.id);
  });

  it("keeps it on the creator's board while the creator is named too", async () => {
    const created = await create(manager, { participantIds: [idOf(manager), idOf(colleague)] });
    expect(await board(manager)).toContain(created.body.id);
    expect(await board(colleague)).toContain(created.body.id);
  });

  it("leaves a task nobody takes part in to its creator and the admins", async () => {
    const created = await create(manager);
    expect(await board(manager)).toContain(created.body.id);
    expect(await board(colleague)).not.toContain(created.body.id);
    expect(await board(admin)).toContain(created.body.id);
  });

  it("shows a task with no project to the colleague named on it", async () => {
    const created = await create(manager, { projectId: null, participantIds: [idOf(colleague)] });
    expect(await board(colleague)).toContain(created.body.id);
    expect(await board(guest)).not.toContain(created.body.id);
  });
});
