import request from "supertest";
import { createApp } from "../src/composition/app.js";
import { prisma } from "../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "./helpers/db.js";
import { createInvite, grantAccess, signInAs } from "./helpers/auth.js";
import { resetIdentityRateLimits } from "../src/modules/identity/presentation/http/identity-http.js";

const app = createApp();
beforeEach(async () => { await resetDb(); resetIdentityRateLimits(); });
afterAll(() => prisma.$disconnect());

it("rejects concurrent stale document writes and requires an explicit revision", async () => {
  const author = await signInAs("Document Author");
  const { projectId } = await seedProject(author.user.id);
  const root = `/api/projects/${projectId}/documents`;
  const created = await request(app).post(root).set(author.auth).send({ title: "Shared" }).expect(201);
  expect(created.body.revision).toBe(1);
  const url = `${root}/${created.body.id}`;
  await request(app).patch(url).set(author.auth).send({ title: "Unprotected" }).expect(400);
  const content = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
  const responses = await Promise.all(["First", "Second"].map((text) =>
    request(app).patch(url).set(author.auth).send({ expectedRevision: 1, content: content(text) })));
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  const winner = responses.find((response) => response.status === 200)!;
  const stored = await request(app).get(url).set(author.auth).expect(200);
  expect(stored.body.content).toEqual(winner.body.content);
  expect(stored.body.revision).toBe(2);
});

it("hides notifications after task visibility, membership or organization access changes", async () => {
  const admin = await signInAs("Admin");
  const viewer = await signInAs("Customer", { role: "CLIENT" });
  const { projectId, clientId } = await seedProject(admin.user.id);
  await grantAccess(viewer.membership!.id, clientId);
  const task = await prisma.task.create({ data: {
    orgId: admin.actor!.orgId, projectId, title: "Shared task", priority: "MEDIUM", position: 0, visibleToClient: true,
  } });
  await prisma.notification.create({ data: { recipientId: viewer.membership!.id, projectId, taskId: task.id, kind: "TASK_ASSIGNED" } });
  expect((await request(app).get("/api/notifications").set(viewer.auth)).body.unreadCount).toBe(1);
  await prisma.task.update({ where: { id: task.id }, data: { visibleToClient: false, title: "PRIVATE TASK" } });
  expect((await request(app).get("/api/notifications").set(viewer.auth)).body).toEqual({ notifications: [], unreadCount: 0 });
  await prisma.task.update({ where: { id: task.id }, data: { visibleToClient: true } });
  await prisma.membership.update({ where: { id: viewer.membership!.id }, data: { status: "SUSPENDED" } });
  await request(app).get("/api/notifications").set(viewer.auth).expect(403);
  await prisma.membership.update({ where: { id: viewer.membership!.id }, data: { status: "ACTIVE" } });
  await prisma.organization.update({ where: { id: admin.actor!.orgId }, data: { status: "SUSPENDED" } });
  await request(app).get("/api/notifications").set(viewer.auth).expect(403);
});

it("removes revoked project notifications from reads, counts and read actions", async () => {
  const admin = await signInAs("Admin");
  const viewer = await signInAs("Viewer", { role: "MANAGER" });
  const { projectId, clientId } = await seedProject(admin.user.id);
  await grantAccess(viewer.membership!.id, clientId, projectId);
  const notice = await prisma.notification.create({ data: { recipientId: viewer.membership!.id, projectId, kind: "KPI_MET" } });
  expect((await request(app).get("/api/notifications").set(viewer.auth)).body.unreadCount).toBe(1);
  await prisma.clientAccess.deleteMany({ where: { membershipId: viewer.membership!.id } });
  await prisma.project.update({ where: { id: projectId }, data: { name: "PRIVATE AFTER REVOCATION" } });
  const response = await request(app).get("/api/notifications").set(viewer.auth).expect(200);
  expect(response.body).toEqual({ notifications: [], unreadCount: 0 });
  await request(app).post(`/api/notifications/${notice.id}/read`).set(viewer.auth).expect(404);
  await request(app).post("/api/notifications/read-all").set(viewer.auth).expect(204);
  expect((await prisma.notification.findUniqueOrThrow({ where: { id: notice.id } })).readAt).toBeNull();
});

it("hides a moved task notification when its historical project becomes inaccessible", async () => {
  const admin = await signInAs("Admin");
  const viewer = await signInAs("Viewer", { role: "MANAGER" });
  const previous = await seedProject(admin.user.id);
  const current = await seedProject(admin.user.id);
  await grantAccess(viewer.membership!.id, previous.clientId, previous.projectId);
  await grantAccess(viewer.membership!.id, current.clientId, current.projectId);
  const task = await prisma.task.create({ data: {
    orgId: admin.actor!.orgId, projectId: previous.projectId, title: "Moved task", priority: "MEDIUM", position: 0,
    participants: { create: { membershipId: viewer.membership!.id } },
  } });
  await prisma.notification.create({ data: { recipientId: viewer.membership!.id, projectId: previous.projectId, taskId: task.id, kind: "TASK_ASSIGNED" } });
  await prisma.task.update({ where: { id: task.id }, data: { projectId: current.projectId } });
  await prisma.clientAccess.deleteMany({ where: { membershipId: viewer.membership!.id, projectId: previous.projectId } });
  await prisma.project.update({ where: { id: previous.projectId }, data: { name: "PRIVATE PREVIOUS PROJECT" } });
  await request(app).get(`/api/tasks/${task.id}`).set(viewer.auth).expect(200);

  const response = await request(app).get("/api/notifications").set(viewer.auth).expect(200);
  expect(response.body).toEqual({ notifications: [], unreadCount: 0 });
});

it("revokes old refresh sessions on password change while the current replacement can renew", async () => {
  await createInvite("integrity-invite");
  const registered = await request(app).post("/api/auth/register").send({
    name: "Audit", email: "audit@example.com", password: "oldpassword123", inviteCode: "integrity-invite",
  }).expect(201);
  const updated = await request(app).patch("/api/user/profile")
    .set("Authorization", `Bearer ${registered.body.accessToken}`)
    .send({ name: "Audit", currentPassword: "oldpassword123", newPassword: "newpassword123" }).expect(200);
  expect(updated.body.refreshToken).toBeTruthy();
  expect(updated.body.refreshToken).not.toBe(registered.body.refreshToken);
  await request(app).post("/api/auth/refresh").send({ refreshToken: registered.body.refreshToken }).expect(401);
  await request(app).post("/api/auth/refresh").send({ refreshToken: updated.body.refreshToken }).expect(200);
  expect((updated.headers["set-cookie"] as unknown as string[]).some((cookie) => cookie.startsWith("adpulse_refresh="))).toBe(true);
});
