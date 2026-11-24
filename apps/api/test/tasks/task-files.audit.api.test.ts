import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";
import { BUSINESS_EVENTS } from "../helpers/audit.js";

const app = createApp();
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

let admin: SignedIn;
let projectId: string;
let clientId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Admin", { role: "ADMIN" });
  ({ clientId, projectId } = await seedProject(admin.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

const uploadDocument = async (auth = admin.auth, name = "brief.pdf") =>
  (await request(app).post("/api/task-documents").set(auth)
    .attach("file", PDF, { filename: name, contentType: "application/pdf" })).body.id as string;

const uploadImage = async (auth = admin.auth) =>
  (await request(app).post("/api/task-images").set(auth)
    .attach("image", PNG, { filename: "a.png", contentType: "image/png" })).body.id as string;

const describedBy = (imageId: string) => ({
  type: "doc",
  content: [{ type: "taskImage", attrs: { imageId } }],
});

const createTask = async (body: Record<string, unknown> = {}) =>
  (await request(app).post("/api/tasks").set(admin.auth).send({ projectId, title: "Макет", priority: "LOW", ...body })).body.id as string;

const events = () => prisma.auditEvent.findMany({ where: BUSINESS_EVENTS, orderBy: { createdAt: "asc" } });
const eventsOf = (entityType: string) => prisma.auditEvent.findMany({ where: { entityType } });

describe("attaching files to a task", () => {
  it("names the documents and images a new task takes, in its own event", async () => {
    const documentId = await uploadDocument(admin.auth, "Бриф.pdf");
    const imageId = await uploadImage();

    const taskId = await createTask({ documentIds: [documentId], description: describedBy(imageId) });

    const [event, ...others] = await prisma.auditEvent.findMany({ where: { entityId: taskId } });
    expect(others).toHaveLength(0);
    expect(event!.changes).toEqual({ documentsAdded: [{ id: documentId, name: "Бриф.pdf" }], imagesAdded: [imageId] });
    expect(await eventsOf("task-document")).toHaveLength(0);
    expect(await eventsOf("task-image")).toHaveLength(0);
  });

  it("names only what an update attaches, and nothing when the files stay", async () => {
    const first = await uploadDocument(admin.auth, "Первый.pdf");
    const taskId = await createTask({ documentIds: [first] });
    const second = await uploadDocument(admin.auth, "Второй.pdf");

    await request(app).patch(`/api/tasks/${taskId}`).set(admin.auth).send({ documentIds: [first, second] });
    await request(app).patch(`/api/tasks/${taskId}`).set(admin.auth).send({ documentIds: [first, second] });

    const updates = await prisma.auditEvent.findMany({
      where: { entityId: taskId, action: "UPDATE" }, orderBy: { createdAt: "asc" },
    });
    expect(updates).toHaveLength(2);
    expect(updates[0]!.changes).toEqual({ documentsAdded: [{ id: second, name: "Второй.pdf" }] });
    expect(updates[1]!.changes).toBeNull();
  });
});

describe("removing a file from a task", () => {
  it("writes one deletion event for a document, naming the task", async () => {
    const documentId = await uploadDocument(admin.auth, "Бриф.pdf");
    const taskId = await createTask({ documentIds: [documentId] });

    const res = await request(app).delete(`/api/task-documents/${documentId}`).set(admin.auth);

    expect(res.status).toBe(204);
    const removed = await eventsOf("task-document");
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({
      action: "DELETE", entityId: documentId, clientId, projectId,
      summary: "Removed document “Бриф.pdf” from task “Макет”",
      changes: { taskId, name: "Бриф.pdf" },
    });
  });

  it("writes one deletion event for an image, naming the task", async () => {
    const imageId = await uploadImage();
    const taskId = await createTask({ description: describedBy(imageId) });

    const res = await request(app).delete(`/api/task-images/${imageId}`).set(admin.auth);

    expect(res.status).toBe(204);
    const removed = await eventsOf("task-image");
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({
      action: "DELETE", entityId: imageId, clientId, projectId,
      summary: "Removed an image from task “Макет”", changes: { taskId },
    });
  });

  it("carries the lead of a task of a lead", async () => {
    const documentId = await uploadDocument();
    const leadId = (await request(app).post(`/api/crm/boards/${projectId}/leads`).set(admin.auth).send({ name: "Анна" })).body.id as string;
    const created = await request(app).post("/api/tasks").set(admin.auth)
      .send({ leadId, title: "Перезвонить", priority: "LOW", dueDate: "2026-10-20", documentIds: [documentId] });
    expect(created.status).toBe(201);

    await request(app).delete(`/api/task-documents/${documentId}`).set(admin.auth);

    expect((await eventsOf("task-document"))[0]!.leadId).toBe(leadId);
  });

  it("writes nothing for an upload that was never attached", async () => {
    const documentId = await uploadDocument();
    const imageId = await uploadImage();
    const before = await events();

    await request(app).delete(`/api/task-documents/${documentId}`).set(admin.auth);
    await request(app).delete(`/api/task-images/${imageId}`).set(admin.auth);

    expect(await events()).toHaveLength(before.length);
  });

  it("writes nothing for a personal task", async () => {
    const customer = await signInAs("Клиент", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);
    const documentId = await uploadDocument(customer.auth);
    const personal = await request(app).post("/api/tasks").set(customer.auth)
      .send({ title: "Личное", priority: "LOW", documentIds: [documentId] });
    expect(personal.body.personal).toBe(true);

    const res = await request(app).delete(`/api/task-documents/${documentId}`).set(customer.auth);

    expect(res.status).toBe(204);
    expect(await eventsOf("task-document")).toHaveLength(0);
    expect(await prisma.auditEvent.count({ where: { entityId: personal.body.id } })).toBe(0);
  });
});
