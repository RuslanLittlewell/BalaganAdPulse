import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let manager: SignedIn;
let clientId: string;
let projectId: string;
let leadId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Женя Радюк");
  manager = await signInAs("Мария", { role: "MANAGER" });
  ({ clientId, projectId } = await seedProject(admin.user.id));
  await grantAccess(manager.membership!.id, clientId);
  leadId = (await request(app).post(`/api/crm/boards/${projectId}/leads`).set(admin.auth).send({ name: "Леонид" })).body.id;
});

afterAll(() => prisma.$disconnect());

const notes = (lead = leadId) => `/api/crm/boards/${projectId}/leads/${lead}/notes`;
const write = (body: string, as = admin.auth) => request(app).post(notes()).set(as).send({ body });

describe("notes on a lead", () => {
  it("stores a note with its author and lists the notes oldest first", async () => {
    const first = await write("Позвонил, просит КП");
    const second = await write("Отправил КП", manager.auth);

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ body: "Позвонил, просит КП", author: { name: "Женя Радюк" }, editedAt: null });
    const listed = await request(app).get(notes()).set(admin.auth);
    expect(listed.body.map((note: { id: string }) => note.id)).toEqual([first.body.id, second.body.id]);
  });

  it("refuses a blank or too long note", async () => {
    expect((await write("   ")).status).toBe(400);
    expect((await write("а".repeat(5001))).status).toBe(400);
    expect(await prisma.leadNote.count()).toBe(0);
  });

  it("lets only the author edit and marks the note edited", async () => {
    const note = await write("Черновик");

    expect((await request(app).patch(`${notes()}/${note.body.id}`).set(manager.auth).send({ body: "Чужое" })).status).toBe(403);
    const edited = await request(app).patch(`${notes()}/${note.body.id}`).set(admin.auth).send({ body: "Готово" });
    expect(edited.status).toBe(200);
    expect(edited.body.body).toBe("Готово");
    expect(edited.body.editedAt).not.toBeNull();
  });

  it("lets the author and an admin delete, nobody else", async () => {
    const mine = await write("Моя", manager.auth);
    const other = await signInAs("Олег", { role: "MANAGER" });
    await grantAccess(other.membership!.id, clientId);

    expect((await request(app).delete(`${notes()}/${mine.body.id}`).set(other.auth)).status).toBe(403);
    expect((await request(app).delete(`${notes()}/${mine.body.id}`).set(admin.auth)).status).toBe(204);
    const own = await write("Своя", manager.auth);
    expect((await request(app).delete(`${notes()}/${own.body.id}`).set(manager.auth)).status).toBe(204);
  });

  it("lets a guest read but not write", async () => {
    await write("Видно всем");
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);

    expect((await request(app).get(notes()).set(guest.auth)).body).toHaveLength(1);
    expect((await write("Гость", guest.auth)).status).toBe(403);
  });

  it("answers 404 for a lead the member does not reach", async () => {
    const outsider = await signInAs("Manager", { role: "MANAGER" });
    expect((await request(app).get(notes()).set(outsider.auth)).status).toBe(404);
    expect((await write("Чужой", outsider.auth)).status).toBe(404);
  });

  it("is deleted with its lead", async () => {
    await write("Заметка");
    await request(app).delete(`/api/crm/boards/${projectId}/leads/${leadId}`).set(admin.auth);
    expect(await prisma.leadNote.count()).toBe(0);
  });
});
