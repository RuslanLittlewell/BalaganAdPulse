import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

let auth: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  ({ projectId } = await seedProject(admin.user.id));
});
afterAll(async () => { await prisma.$disconnect(); });

const upload = async (as = auth) => {
  const res = await request(app).post("/api/task-images").set(as)
    .attach("image", PNG, { filename: "a.png", contentType: "image/png" });
  return res.body.id as string;
};

const describedBy = (imageId: string) => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Смотри" }] },
    { type: "taskImage", attrs: { imageId } },
  ],
});

describe("DELETE /api/task-images/:id", () => {
  it("removes an unattached upload the caller made", async () => {
    const imageId = await upload();

    const res = await request(app).delete(`/api/task-images/${imageId}`).set(auth);

    expect(res.status).toBe(204);
    expect(await prisma.taskImage.count({ where: { id: imageId } })).toBe(0);
  });

  it("removes an attached image and the reference the description holds", async () => {
    const imageId = await upload();
    const created = await request(app).post("/api/tasks").set(auth).send({
      projectId, title: "С вложением", priority: "LOW", description: describedBy(imageId),
    });
    expect(created.body.imageIds).toEqual([imageId]);

    const res = await request(app).delete(`/api/task-images/${imageId}`).set(auth);

    expect(res.status).toBe(204);
    // A description left pointing at a deleted object shows a link that can
    // never open, so the node has to go with the row.
    const task = await request(app).get(`/api/tasks/${created.body.id}`).set(auth);
    expect(task.body.imageIds).toEqual([]);
    expect(JSON.stringify(task.body.description)).not.toContain(imageId);
    expect(JSON.stringify(task.body.description)).toContain("Смотри");
  });

  it("404s for an image that does not exist", async () => {
    const res = await request(app).delete(`/api/task-images/${MISSING}`).set(auth);
    expect(res.status).toBe(404);
  });

  it("404s for somebody else's unattached upload", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const imageId = await upload(other.auth);

    const res = await request(app).delete(`/api/task-images/${imageId}`).set(auth);

    expect(res.status).toBe(404);
    expect(await prisma.taskImage.count({ where: { id: imageId } })).toBe(1);
  });

  it("404s for an image on a task the caller cannot reach", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const theirClient = await request(app).post("/api/clients").set(other.auth)
      .send({ name: "Theirs" });
    const theirProject = await request(app).post("/api/projects").set(other.auth)
      .send({ clientId: theirClient.body.id, name: "Theirs" });
    const imageId = await upload(other.auth);
    await request(app).post("/api/tasks").set(other.auth).send({
      projectId: theirProject.body.id, title: "Их задача", priority: "LOW",
      description: describedBy(imageId),
    });

    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const res = await request(app).delete(`/api/task-images/${imageId}`).set(stranger.auth);

    expect(res.status).toBe(404);
    expect(await prisma.taskImage.count({ where: { id: imageId } })).toBe(1);
  });

  it("requires authentication", async () => {
    const imageId = await upload();
    const res = await request(app).delete(`/api/task-images/${imageId}`);
    expect(res.status).toBe(401);
  });

  it("refuses a role that may not change a task", async () => {
    const imageId = await upload();
    const guest = await signInAs("Guest", { role: "GUEST" });

    const res = await request(app).delete(`/api/task-images/${imageId}`).set(guest.auth);

    expect(res.status).toBe(404);
    expect(await prisma.taskImage.count({ where: { id: imageId } })).toBe(1);
  });
});
