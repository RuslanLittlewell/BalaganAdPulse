import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { currentOrg, signInAs, type SignedIn } from "../helpers/auth.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";

const app = createApp();
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");

let admin: SignedIn;
let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Admin", { role: "ADMIN" });
  ({ clientId, projectId } = await seedProject(admin.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

const createLead = async (name: string, board = projectId) =>
  (await request(app).post(`/api/crm/boards/${board}/leads`).set(admin.auth).send({ name })).body.id as string;

const createTask = async (body: Record<string, unknown> = {}) =>
  (await request(app).post("/api/tasks").set(admin.auth)
    .send({ projectId, title: "Задача", priority: "LOW", dueDate: "2026-10-20", ...body })).body.id as string;

const eventOf = (entityType: string, entityId: string) =>
  prisma.auditEvent.findFirstOrThrow({ where: { entityType, entityId, action: "DELETE" } });

describe("deleting a project", () => {
  it("counts what the database removes with it and writes no event for those", async () => {
    await seedCampaign(projectId);
    const withTask = await createLead("Анна");
    await createLead("Борис");
    await createTask();
    await createTask({ title: "Ещё" });
    await createTask({ leadId: withTask });
    await prisma.projectDocument.create({ data: { projectId, title: "Бриф" } });

    const res = await request(app).delete(`/api/projects/${projectId}`).set(admin.auth);

    expect(res.status).toBe(204);
    expect((await eventOf("project", projectId)).changes).toEqual({
      removedWith: { campaigns: 1, leads: 2, tasks: 3, documents: 1 },
    });
    expect(await prisma.auditEvent.count({ where: { action: "DELETE", entityType: { in: ["task", "lead"] } } })).toBe(0);
  });

  it("carries no counts when nothing was under it", async () => {
    const { projectId: bare } = await seedProject(admin.user.id, "Пустой");

    await request(app).delete(`/api/projects/${bare}`).set(admin.auth);

    expect((await eventOf("project", bare)).changes).toBeNull();
  });
});

describe("deleting a client", () => {
  it("counts across its projects, and its companies and people", async () => {
    const orgId = (await currentOrg()).id;
    const second = await prisma.project.create({ data: { clientId, name: "Второй", position: 1 } });
    await createLead("Анна");
    await createLead("Борис", second.id);
    await createTask();
    await prisma.company.create({ data: { orgId, clientId, name: "Лода" } });
    await prisma.person.create({ data: { orgId, clientId, name: "Иван" } });
    await prisma.person.create({ data: { orgId, clientId, name: "Пётр" } });

    const persons = await prisma.person.count({ where: { clientId } });
    expect(persons).toBeGreaterThanOrEqual(2);

    const res = await request(app).delete(`/api/clients/${clientId}`).set(admin.auth);

    expect(res.status).toBe(204);
    expect((await eventOf("client", clientId)).changes).toEqual({
      removedWith: { projects: 2, companies: 1, persons, leads: 2, tasks: 1 },
    });
  });
});

describe("deleting a lead", () => {
  it("counts its tasks, notes and files and keeps the lead as it was", async () => {
    const leadId = await createLead("Анна");
    await createTask({ leadId });
    await createTask({ leadId, title: "Позвонить" });
    await request(app).post(`/api/crm/boards/${projectId}/leads/${leadId}/notes`).set(admin.auth).send({ body: "Заметка" });
    await prisma.leadFile.create({
      data: { orgId: (await currentOrg()).id, leadId, name: "КП.pdf", contentType: "application/pdf", bytes: 3, storageKey: "leads/test-key" },
    });

    const res = await request(app).delete(`/api/crm/boards/${projectId}/leads/${leadId}`).set(admin.auth);

    expect(res.status).toBe(204);
    const { changes } = await eventOf("lead", leadId);
    expect(changes).toMatchObject({ before: { id: leadId, name: "Анна" }, removedWith: { tasks: 2, notes: 1, files: 1 } });
  });

  it("carries no counts for a lead with nothing under it", async () => {
    const leadId = await createLead("Анна");

    await request(app).delete(`/api/crm/boards/${projectId}/leads/${leadId}`).set(admin.auth);

    const { changes } = await eventOf("lead", leadId);
    expect(changes).toHaveProperty("before");
    expect(changes).not.toHaveProperty("removedWith");
  });
});

describe("deleting a task", () => {
  it("counts its comments, and its images and documents together", async () => {
    const document = (await request(app).post("/api/task-documents").set(admin.auth)
      .attach("file", PDF, { filename: "brief.pdf", contentType: "application/pdf" })).body.id as string;
    const image = (await request(app).post("/api/task-images").set(admin.auth)
      .attach("image", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]), { filename: "a.png", contentType: "image/png" })).body.id as string;
    const taskId = await createTask({
      documentIds: [document],
      description: { type: "doc", content: [{ type: "taskImage", attrs: { imageId: image } }] },
    });
    for (const body of ["Раз", "Два"]) {
      await request(app).post(`/api/tasks/${taskId}/comments`).set(admin.auth).send({ body });
    }

    const res = await request(app).delete(`/api/tasks/${taskId}`).set(admin.auth);

    expect(res.status).toBe(204);
    expect((await eventOf("task", taskId)).changes).toEqual({ removedWith: { comments: 2, files: 2 } });
  });

  it("carries no counts for a task with nothing under it", async () => {
    const taskId = await createTask();

    await request(app).delete(`/api/tasks/${taskId}`).set(admin.auth);

    expect((await eventOf("task", taskId)).changes).toBeNull();
  });
});
