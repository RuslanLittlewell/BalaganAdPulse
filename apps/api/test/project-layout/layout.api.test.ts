import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let auth: { Authorization: string };
let clientId: string;

async function newProject(name: string): Promise<string> {
  const created = await request(app).post("/api/projects").set(auth).send({ clientId, name });
  return created.body.id as string;
}

async function newGroup(name = "Клиенты"): Promise<string> {
  const created = await request(app).post("/api/project-groups").set(auth).send({ name });
  return created.body.id as string;
}

const layout = () => request(app).get("/api/project-layout").set(auth);

beforeEach(async () => {
  await resetDb();
  ({ auth } = await signInAs());
  const client = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
  clientId = client.body.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Project layout API", () => {
  it("lists every reachable project as a top-level item before it is arranged", async () => {
    const first = await newProject("Первый");
    const second = await newProject("Второй");

    const res = await layout();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      pinned: [],
      items: [
        { type: "project", projectId: first },
        { type: "project", projectId: second },
      ],
    });
  });

  it("stores an arrangement and reads it back", async () => {
    const first = await newProject("Первый");
    const second = await newProject("Второй");
    const groupId = await newGroup();

    const saved = await request(app).put("/api/project-layout").set(auth).send({
      pinned: [second],
      items: [{ type: "group", groupId, projectIds: [first] }],
    });

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({
      pinned: [second],
      items: [{ type: "group", groupId, name: "Клиенты", projectIds: [first] }],
    });
    expect((await layout()).body).toEqual(saved.body);
  });

  it("keeps one member's arrangement invisible to another", async () => {
    const first = await newProject("Первый");
    const second = await newProject("Второй");
    await request(app).put("/api/project-layout").set(auth).send({
      pinned: [second], items: [{ type: "project", projectId: first }],
    });

    const { auth: theirs } = await signInAs("Colleague");
    const res = await request(app).get("/api/project-layout").set(theirs);

    expect(res.body.pinned).toEqual([]);
    expect(res.body.items).toEqual([
      { type: "project", projectId: first },
      { type: "project", projectId: second },
    ]);
  });

  it("refuses an arrangement naming a project the member cannot reach", async () => {
    await newProject("Первый");
    const res = await request(app).put("/api/project-layout").set(auth).send({
      pinned: [], items: [{ type: "project", projectId: MISSING }],
    });
    expect(res.status).toBe(404);
  });

  it("refuses a malformed arrangement", async () => {
    const res = await request(app).put("/api/project-layout").set(auth).send({ items: "everything" });
    expect(res.status).toBe(400);
  });

  it("creates an empty group at the end of the list (201)", async () => {
    const first = await newProject("Первый");
    const created = await request(app).post("/api/project-groups").set(auth).send({ name: "Клиенты" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Клиенты" });
    expect((await layout()).body.items).toEqual([
      { type: "project", projectId: first },
      { type: "group", groupId: created.body.id, name: "Клиенты", projectIds: [] },
    ]);
  });

  it("refuses a group without a name", async () => {
    const res = await request(app).post("/api/project-groups").set(auth).send({ name: "  " });
    expect(res.status).toBe(400);
  });

  it("deletes an empty group (204)", async () => {
    const groupId = await newGroup();
    const res = await request(app).delete(`/api/project-groups/${groupId}`).set(auth);

    expect(res.status).toBe(204);
    expect((await layout()).body.items).toEqual([]);
  });

  it("refuses to delete a group that still holds a project (409)", async () => {
    const projectId = await newProject("Первый");
    const groupId = await newGroup();
    await request(app).put("/api/project-layout").set(auth).send({
      pinned: [], items: [{ type: "group", groupId, projectIds: [projectId] }],
    });

    const res = await request(app).delete(`/api/project-groups/${groupId}`).set(auth);

    expect(res.status).toBe(409);
    expect((await layout()).body.items).toEqual([
      { type: "group", groupId, name: "Клиенты", projectIds: [projectId] },
    ]);
  });

  it("answers 404 for a group belonging to another member", async () => {
    const groupId = await newGroup();
    const { auth: theirs } = await signInAs("Colleague");
    const res = await request(app).delete(`/api/project-groups/${groupId}`).set(theirs);
    expect(res.status).toBe(404);
  });

  it("refuses an anonymous caller", async () => {
    expect((await request(app).get("/api/project-layout")).status).toBe(401);
  });
});
