import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function scenario() {
  const admin = await signInAs("Admin", { role: "ADMIN" });
  const { projectId } = await seedProject(admin.user.id, "Acme");
  const org = await currentOrg();
  return { admin, projectId, orgId: org.id };
}

describe("the task table", () => {
  it("defaults a new task to the IDEA column", async () => {
    const { projectId, orgId } = await scenario();
    const task = await prisma.task.create({
      data: { projectId, orgId, title: "Write the brief", priority: "MEDIUM", position: 0 },
    });
    expect(task.column).toBe("IDEA");
    expect(task.description).toBeNull();
    expect(task.assigneeId).toBeNull();
  });

  it("stores a structured description and reads it back whole", async () => {
    const { projectId, orgId } = await scenario();
    const description = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
    const task = await prisma.task.create({
      data: { projectId, orgId, title: "T", priority: "LOW", position: 0, description },
    });
    expect(task.description).toEqual(description);
  });

  it("goes with its project", async () => {
    const { projectId, orgId } = await scenario();
    await prisma.task.create({ data: { projectId, orgId, title: "T", priority: "LOW", position: 0 } });
    await prisma.project.delete({ where: { id: projectId } });
    expect(await prisma.task.count()).toBe(0);
  });

  it("keeps a task standing when the member responsible for it is removed", async () => {
    const { projectId, orgId } = await scenario();
    const member = await signInAs("Member", { role: "MANAGER" });
    const task = await prisma.task.create({
      data: { projectId, orgId, title: "T", priority: "LOW", position: 0, assigneeId: member.membership!.id },
    });

    await prisma.membership.delete({ where: { id: member.membership!.id } });
    const after = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.assigneeId).toBeNull();
  });

  it("takes its images with it when it is deleted", async () => {
    const { admin, projectId, orgId } = await scenario();
    const task = await prisma.task.create({
      data: { projectId, orgId, title: "T", priority: "LOW", position: 0 },
    });
    await prisma.taskImage.create({
      data: {
        taskId: task.id, uploaderId: admin.membership!.id,
        storageKey: "tasks/x.png", contentType: "image/png", bytes: 10,
      },
    });

    await prisma.task.delete({ where: { id: task.id } });
    expect(await prisma.taskImage.count()).toBe(0);
  });

  it("lets an image exist before any task claims it", async () => {
    const { admin } = await scenario();
    const image = await prisma.taskImage.create({
      data: {
        uploaderId: admin.membership!.id, storageKey: "tasks/loose.png",
        contentType: "image/png", bytes: 10,
      },
    });
    expect(image.taskId).toBeNull();
  });
});
