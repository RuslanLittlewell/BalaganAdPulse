import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.7 pretending to be a picture");

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

const upload = (bytes: Buffer, auth = admin, filename = "shot.png") =>
  request(app).post("/api/task-images").set(auth)
    .attach("image", bytes, { filename, contentType: "image/png" });

describe("POST /api/task-images", () => {
  it("stores a pasted PNG and records it against its uploader, claimed by nothing", async () => {
    const res = await upload(PNG);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ contentType: "image/png", taskId: null });

    const stored = await prisma.taskImage.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.storageKey).toContain("tasks/images/");
    expect(stored.bytes).toBe(PNG.length);
  });

  it("refuses a file that is not an image, however it is named -> 400", async () => {
    const res = await upload(PDF);
    expect(res.status).toBe(400);
    expect(await prisma.taskImage.count()).toBe(0);
  });

  it("refuses a request with no file -> 400", async () => {
    expect((await request(app).post("/api/task-images").set(admin)).status).toBe(400);
  });

  it("refuses a guest -> 403", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    expect((await upload(PNG, guest.auth)).status).toBe(403);
  });

  it("refuses an unauthenticated caller -> 401", async () => {
    const res = await request(app).post("/api/task-images")
      .attach("image", PNG, { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/task-images/:id", () => {
  it("serves the bytes back to the member who uploaded them", async () => {
    const created = await upload(PNG);
    const res = await request(app).get(`/api/task-images/${created.body.id}`).set(admin);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(Buffer.from(res.body)).toEqual(PNG);
  });

  it("hides an unattached image from anyone but its uploader -> 404", async () => {
    const created = await upload(PNG);
    const other = await signInAs("Other", { role: "MANAGER" });
    expect((await request(app).get(`/api/task-images/${created.body.id}`).set(other.auth)).status).toBe(404);
  });

  it("answers 404 for an image that does not exist", async () => {
    expect((await request(app).get(`/api/task-images/${MISSING}`).set(admin)).status).toBe(404);
  });

  it("refuses an address opened without a token -> 401", async () => {
    const created = await upload(PNG);
    expect((await request(app).get(`/api/task-images/${created.body.id}`)).status).toBe(401);
  });

  describe("once a description claims it", () => {
    async function taskWithImage() {
      const image = await upload(PNG);
      const description = {
        type: "doc",
        content: [{ type: "taskImage", attrs: { imageId: image.body.id } }],
      };
      const task = await request(app).post("/api/tasks").set(admin)
        .send({ projectId, title: "With a picture", priority: "LOW", description });
      return { imageId: image.body.id as string, taskId: task.body.id as string };
    }

    it("belongs to the task, and anyone who reaches the task may read it", async () => {
      const { imageId, taskId } = await taskWithImage();
      const stored = await prisma.taskImage.findUniqueOrThrow({ where: { id: imageId } });
      expect(stored.taskId).toBe(taskId);

      const manager = await signInAs("Manager", { role: "MANAGER" });
      await grantAccess(manager.membership!.id, clientId);
      await prisma.task.update({
        where: { id: taskId }, data: { assigneeId: manager.membership!.id },
      });
      expect((await request(app).get(`/api/task-images/${imageId}`).set(manager.auth)).status).toBe(200);
    });

    it("is hidden from a member who cannot reach the task -> 404", async () => {
      const { imageId } = await taskWithImage();
      const stranger = await signInAs("Stranger", { role: "MANAGER" });
      expect((await request(app).get(`/api/task-images/${imageId}`).set(stranger.auth)).status).toBe(404);
    });

    it("goes when the task is deleted", async () => {
      const { imageId, taskId } = await taskWithImage();
      await request(app).delete(`/api/tasks/${taskId}`).set(admin);
      expect(await prisma.taskImage.findUnique({ where: { id: imageId } })).toBeNull();
    });

    it("cannot be claimed by another member's task", async () => {
      const image = await upload(PNG);
      const other = await signInAs("Other", { role: "MANAGER" });
      await grantAccess(other.membership!.id, clientId);

      await request(app).post("/api/tasks").set(other.auth).send({
        projectId, title: "Thief", priority: "LOW",
        description: { type: "doc", content: [{ type: "taskImage", attrs: { imageId: image.body.id } }] },
      });

      const stored = await prisma.taskImage.findUniqueOrThrow({ where: { id: image.body.id } });
      expect(stored.taskId).toBeNull();
    });
  });

  it("an upload abandoned before the task was saved stays findable as unclaimed", async () => {
    await upload(PNG);
    const loose = await prisma.taskImage.findMany({ where: { taskId: null } });
    expect(loose).toHaveLength(1);
    expect(loose[0]!.createdAt).toBeInstanceOf(Date);
  });
});
