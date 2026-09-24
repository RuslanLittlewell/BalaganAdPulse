import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let clientId: string;
let projectId: string;
let leadId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Женя Радюк");
  ({ clientId, projectId } = await seedProject(admin.user.id));
  leadId = (await request(app).post(`/api/crm/boards/${projectId}/leads`).set(admin.auth).send({ name: "Леонид" })).body.id;
});

afterAll(() => prisma.$disconnect());

const files = (lead = leadId, board = projectId) => `/api/crm/boards/${board}/leads/${lead}/files`;
const CONTRACT = Buffer.from("%PDF-1.4 договор");
const attach = (bytes = CONTRACT, filename = "Договор.pdf", as = admin.auth) =>
  request(app).post(files()).set(as).attach("file", bytes, { filename, contentType: "application/pdf" });

describe("files on a lead", () => {
  it("stores a file and lists it with who added it and when", async () => {
    const added = await attach();

    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({
      name: "Договор.pdf", bytes: CONTRACT.length, contentType: "application/pdf",
      uploader: { name: "Женя Радюк" },
    });
    const listed = await request(app).get(files()).set(admin.auth);
    expect(listed.body).toEqual([expect.objectContaining({ id: added.body.id, name: "Договор.pdf" })]);
    const stored = await prisma.leadFile.findUniqueOrThrow({ where: { id: added.body.id } });
    expect(stored.storageKey).toContain("leads/files/");
  });

  it("lists the newest file first", async () => {
    await attach(CONTRACT, "Первый.pdf");
    await attach(CONTRACT, "Второй.pdf");

    const listed = await request(app).get(files()).set(admin.auth);
    expect(listed.body.map((file: { name: string }) => file.name)).toEqual(["Второй.pdf", "Первый.pdf"]);
  });

  it("downloads a file as an attachment under its name, never as a page", async () => {
    const added = await attach(Buffer.from("<script>alert(1)</script>"), "Смета.html");

    const downloaded = await request(app).get(`${files()}/${added.body.id}`).set(admin.auth)
      .buffer(true).parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });

    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toBe("application/octet-stream");
    expect(downloaded.headers["x-content-type-options"]).toBe("nosniff");
    expect(downloaded.headers["content-disposition"]).toContain("attachment");
    expect(downloaded.headers["content-disposition"]).toContain(`filename*=UTF-8''${encodeURIComponent("Смета.html")}`);
    expect((downloaded.body as Buffer).toString()).toBe("<script>alert(1)</script>");
  });

  it("removes a file", async () => {
    const added = await attach();

    await request(app).delete(`${files()}/${added.body.id}`).set(admin.auth).expect(204);

    expect((await request(app).get(files()).set(admin.auth)).body).toEqual([]);
    expect((await request(app).get(`${files()}/${added.body.id}`).set(admin.auth)).status).toBe(404);
  });

  it("refuses a file over 20 MB and a request with no file", async () => {
    expect((await attach(Buffer.alloc(20 * 1024 * 1024 + 1), "Большой.zip")).status).toBe(400);
    expect((await request(app).post(files()).set(admin.auth)).status).toBe(400);
    expect(await prisma.leadFile.count()).toBe(0);
  });

  it("lets a guest list and download but not attach or remove", async () => {
    const added = await attach();
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);

    expect((await request(app).get(files()).set(guest.auth)).body).toHaveLength(1);
    expect((await request(app).get(`${files()}/${added.body.id}`).set(guest.auth)).status).toBe(200);
    expect((await attach(CONTRACT, "Гость.pdf", guest.auth)).status).toBe(403);
    expect((await request(app).delete(`${files()}/${added.body.id}`).set(guest.auth)).status).toBe(403);
    expect(await prisma.leadFile.count()).toBe(1);
  });

  it("answers 404 for a board the member cannot reach, and for a file of another lead", async () => {
    const added = await attach();
    const other = await prisma.project.create({ data: { clientId, name: "Второй", position: 1 } });
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId, other.id);
    const otherLead = (await request(app).post(`/api/crm/boards/${other.id}/leads`).set(admin.auth).send({ name: "Другой" })).body.id;

    expect((await request(app).get(files()).set(manager.auth)).status).toBe(404);
    expect((await request(app).get(`${files()}/${added.body.id}`).set(manager.auth)).status).toBe(404);
    expect((await request(app).get(`${files(otherLead, other.id)}/${added.body.id}`).set(admin.auth)).status).toBe(404);
    expect((await request(app).get(files("00000000-0000-0000-0000-000000000000")).set(admin.auth)).status).toBe(404);
  });

  it("goes with its lead", async () => {
    const added = await attach();

    await request(app).delete(`/api/crm/boards/${projectId}/leads/${leadId}`).set(admin.auth).expect(204);

    expect(await prisma.leadFile.findUnique({ where: { id: added.body.id } })).toBeNull();
  });

  it("records adding and removing a file against the lead", async () => {
    const added = await attach();
    await request(app).delete(`${files()}/${added.body.id}`).set(admin.auth).expect(204);

    const events = await prisma.auditEvent.findMany({ where: { entityType: "lead", entityId: leadId }, orderBy: { createdAt: "asc" } });
    expect(events.map((event) => event.changes)).toEqual([
      expect.objectContaining({ after: expect.anything() }),
      { fileAdded: { id: added.body.id, name: "Договор.pdf" } },
      { fileRemoved: { id: added.body.id, name: "Договор.pdf" } },
    ]);
    expect(events[1]).toMatchObject({ action: "UPDATE", clientId, projectId, actorId: admin.membership!.id });
  });
});
