import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");

let admin: { Authorization: string };
let projectId: string;
let clientId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs("Admin", { role: "ADMIN" });
  admin = signedIn.auth;
  ({ clientId, projectId } = await seedProject(signedIn.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

const upload = (bytes: Buffer = PDF, auth = admin, filename = "brief.pdf") =>
  request(app).post("/api/task-documents").set(auth)
    .attach("file", bytes, { filename, contentType: "application/pdf" });

const taskWith = async (documentIds: string[]) =>
  request(app).post("/api/tasks").set(admin).send({ projectId, title: "With papers", priority: "LOW", documentIds });

describe("POST /api/task-documents", () => {
  it("stores a PDF with its name and size, attached to nothing yet", async () => {
    const res = await upload(PDF, admin, "Бриф клиента.pdf");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Бриф клиента.pdf", bytes: PDF.length, taskId: null });
    expect(res.body.storageKey).toBeUndefined();
    const stored = await prisma.taskDocument.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.storageKey).toContain("tasks/documents/");
  });

  it("refuses a file that is not a PDF, however it is named -> 400", async () => {
    const res = await upload(Buffer.from("PK zip pretending"), admin, "fake.pdf");
    expect(res.status).toBe(400);
    expect(await prisma.taskDocument.count()).toBe(0);
  });

  it("refuses a PDF over 20 MB -> 400, and stores nothing", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(21 * 1024 * 1024)]);
    const res = await upload(big);
    expect(res.status).toBe(400);
    expect(await prisma.taskDocument.count()).toBe(0);
  });

  it("refuses a request with no file -> 400", async () => {
    expect((await request(app).post("/api/task-documents").set(admin)).status).toBe(400);
  });

  it("refuses a guest -> 403 and an unauthenticated caller -> 401", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    expect((await upload(PDF, guest.auth)).status).toBe(403);
    const res = await request(app).post("/api/task-documents").attach("file", PDF, { filename: "a.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/task-documents/:id", () => {
  it("serves the PDF with its name to the member who uploaded it", async () => {
    const created = await upload(PDF, admin, "Бриф.pdf");
    const res = await request(app).get(`/api/task-documents/${created.body.id}`).set(admin).buffer(true).parse((r, done) => {
      const chunks: Buffer[] = [];
      r.on("data", (chunk: Buffer) => chunks.push(chunk));
      r.on("end", () => done(null, Buffer.concat(chunks)));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-disposition"]).toContain(`filename*=UTF-8''${encodeURIComponent("Бриф.pdf")}`);
    expect(res.body).toEqual(PDF);
  });

  it("hides an unattached document from anyone but its uploader -> 404", async () => {
    const created = await upload();
    const other = await signInAs("Other", { role: "MANAGER" });
    expect((await request(app).get(`/api/task-documents/${created.body.id}`).set(other.auth)).status).toBe(404);
  });

  it("answers 404 for a document that does not exist and 401 without a token", async () => {
    expect((await request(app).get(`/api/task-documents/${MISSING}`).set(admin)).status).toBe(404);
    const created = await upload();
    expect((await request(app).get(`/api/task-documents/${created.body.id}`)).status).toBe(401);
  });

  it("belongs to the task once saved, to anyone who reaches it, and to no one else", async () => {
    const created = await upload();
    const task = await taskWith([created.body.id]);
    expect(task.status).toBe(201);
    expect(task.body.documents).toEqual([{ id: created.body.id, name: "brief.pdf", bytes: PDF.length }]);

    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    await prisma.task.update({
      where: { id: task.body.id }, data: { participants: { create: { membershipId: manager.membership!.id } } },
    });
    expect((await request(app).get(`/api/task-documents/${created.body.id}`).set(manager.auth)).status).toBe(200);

    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    expect((await request(app).get(`/api/task-documents/${created.body.id}`).set(stranger.auth)).status).toBe(404);
  });
});

describe("attaching documents to a task", () => {
  it("lists the documents on the task when it is read", async () => {
    const first = await upload(PDF, admin, "a.pdf");
    const second = await upload(PDF, admin, "b.pdf");
    const task = await taskWith([first.body.id, second.body.id]);

    const read = await request(app).get(`/api/tasks?projectId=${projectId}`).set(admin);
    const listed = read.body.find((item: { id: string }) => item.id === task.body.id);
    expect(listed.documents.map((document: { name: string }) => document.name)).toEqual(["a.pdf", "b.pdf"]);
  });

  it("attaches a document when an existing task is saved with its id", async () => {
    const task = await taskWith([]);
    const created = await upload();
    const saved = await request(app).patch(`/api/tasks/${task.body.id}`).set(admin).send({ documentIds: [created.body.id] });
    expect(saved.status).toBe(200);
    expect(saved.body.documents).toHaveLength(1);
  });

  it("does not take another member's unattached document", async () => {
    const theirs = await upload(PDF, (await signInAs("Other", { role: "MANAGER" })).auth);
    const task = await taskWith([theirs.body.id]);
    expect(task.body.documents).toEqual([]);
  });

  it("refuses an eleventh document and keeps the ten", async () => {
    const ids: string[] = [];
    for (let n = 0; n < 10; n++) ids.push((await upload(PDF, admin, `d${n}.pdf`)).body.id);
    const task = await taskWith(ids);
    expect(task.body.documents).toHaveLength(10);

    const extra = await upload(PDF, admin, "extra.pdf");
    const refused = await request(app).patch(`/api/tasks/${task.body.id}`).set(admin).send({ documentIds: [extra.body.id] });
    expect(refused.status).toBe(400);
    expect(await prisma.taskDocument.count({ where: { taskId: task.body.id } })).toBe(10);
  });

  it("keeps the documents when a task is saved without documentIds", async () => {
    const created = await upload();
    const task = await taskWith([created.body.id]);
    const saved = await request(app).patch(`/api/tasks/${task.body.id}`).set(admin).send({ title: "Renamed" });
    expect(saved.body.documents).toHaveLength(1);
  });
});

describe("DELETE /api/task-documents/:id", () => {
  it("removes an unattached upload the caller made", async () => {
    const created = await upload();
    expect((await request(app).delete(`/api/task-documents/${created.body.id}`).set(admin)).status).toBe(204);
    expect(await prisma.taskDocument.count()).toBe(0);
  });

  it("removes a document of a task the caller may change", async () => {
    const created = await upload();
    const task = await taskWith([created.body.id]);
    expect((await request(app).delete(`/api/task-documents/${created.body.id}`).set(admin)).status).toBe(204);
    const read = await request(app).get(`/api/tasks?projectId=${projectId}`).set(admin);
    expect(read.body.find((item: { id: string }) => item.id === task.body.id).documents).toEqual([]);
  });

  it("answers 404 to someone else's unattached upload and to a document that does not exist", async () => {
    const created = await upload();
    const other = await signInAs("Other", { role: "MANAGER" });
    expect((await request(app).delete(`/api/task-documents/${created.body.id}`).set(other.auth)).status).toBe(404);
    expect((await request(app).delete(`/api/task-documents/${MISSING}`).set(admin)).status).toBe(404);
    expect(await prisma.taskDocument.count()).toBe(1);
  });

  it("lets a client's person read a shared task's document but not remove it", async () => {
    const created = await upload();
    const task = await taskWith([created.body.id]);
    await request(app).patch(`/api/tasks/${task.body.id}`).set(admin).send({ visibleToClient: true });
    const person = await signInAs("Client", { role: "CLIENT" });
    await grantAccess(person.membership!.id, clientId);

    expect((await request(app).get(`/api/task-documents/${created.body.id}`).set(person.auth)).status).toBe(200);
    expect((await request(app).delete(`/api/task-documents/${created.body.id}`).set(person.auth)).status).toBe(404);
    expect(await prisma.taskDocument.count({ where: { taskId: task.body.id } })).toBe(1);
  });

  it("is deleted with its task", async () => {
    const created = await upload();
    const task = await taskWith([created.body.id]);
    expect((await request(app).delete(`/api/tasks/${task.body.id}`).set(admin)).status).toBe(204);
    expect(await prisma.taskDocument.count()).toBe(0);
  });
});
