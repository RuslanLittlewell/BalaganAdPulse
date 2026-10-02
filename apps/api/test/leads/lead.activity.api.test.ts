import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Женя Радюк");
  ({ clientId, projectId } = await seedProject(admin.user.id));
});

afterAll(() => prisma.$disconnect());

const leads = () => `/api/crm/boards/${projectId}/leads`;
const activity = (leadId: string, board = projectId, as = admin.auth) =>
  request(app).get(`/api/crm/boards/${board}/leads/${leadId}/activity`).set(as);

describe("a lead's activity", () => {
  it("lists creation, field changes, moves and files newest first, each with who and when", async () => {
    const created = (await request(app).post(leads()).set(admin.auth).send({ name: "Леонид", phone: "+375290000000" })).body;
    const colleague = await signInAs("Мария", { role: "MANAGER" });
    await grantAccess(colleague.membership!.id, clientId);
    await request(app).patch(`${leads()}/${created.id}`).set(colleague.auth).send({ phone: "+375291111111", tags: ["Срочно"] }).expect(200);
    await request(app).patch(`${leads()}/${created.id}/move`).set(colleague.auth).send({ stage: "PROPOSAL", position: 0 }).expect(200);
    const file = (await request(app).post(`${leads()}/${created.id}/files`).set(admin.auth)
      .attach("file", Buffer.from("x"), { filename: "Смета.xlsx", contentType: "application/octet-stream" })).body;
    await request(app).delete(`${leads()}/${created.id}/files/${file.id}`).set(admin.auth).expect(204);

    const response = await activity(created.id);

    expect(response.status).toBe(200);
    expect(response.body.map((entry: { kind: string }) => entry.kind)).toEqual([
      "file-removed", "file-added", "moved", "changed", "created",
    ]);
    const [removed, added, moved, changed, creation] = response.body;
    expect(removed).toMatchObject({ actor: { name: "Женя Радюк" }, file: { name: "Смета.xlsx" } });
    expect(added).toMatchObject({ file: { name: "Смета.xlsx" } });
    expect(moved).toMatchObject({ actor: { name: "Мария" }, stage: { from: "Новый", to: "КП" } });
    expect(changed).toMatchObject({
      actor: { name: "Мария" },
      changes: [
        { field: "tags", before: "", after: "Срочно" },
        { field: "phone", before: "+375290000000", after: "+375291111111" },
      ],
    });
    expect(creation).toMatchObject({ kind: "created", actor: { name: "Женя Радюк" } });
    expect(typeof creation.at).toBe("string");
  });

  it("names the assignee, the campaign and custom columns rather than their ids", async () => {
    const campaign = await seedCampaign(projectId, "Весна");
    const teammate = await signInAs("Олег", { role: "MANAGER" });
    await grantAccess(teammate.membership!.id, clientId);
    const column = (await request(app).post(`/api/crm/boards/${projectId}/columns`).set(admin.auth).send({ name: "Встреча" })).body;
    const created = (await request(app).post(leads()).set(admin.auth).send({ name: "Леонид" })).body;
    await request(app).patch(`${leads()}/${created.id}`).set(admin.auth).send({ assigneeId: teammate.membership!.id, campaignId: campaign.id, amount: "1500" }).expect(200);
    await request(app).patch(`${leads()}/${created.id}/move`).set(admin.auth).send({ stage: column.id, position: 0 }).expect(200);

    const [moved, changed] = (await activity(created.id)).body;

    expect(moved.stage).toEqual({ from: "Новый", to: "Встреча" });
    expect(changed.changes).toEqual([
      { field: "amount", before: "", after: "1500.0000" },
      { field: "assignee", before: "", after: "Олег" },
      { field: "campaign", before: "", after: "Весна" },
    ]);
  });

  it("leaves out an update that changes nothing it tracks", async () => {
    const created = (await request(app).post(leads()).set(admin.auth).send({ name: "Леонид", notes: "Звонить" })).body;
    await request(app).patch(`${leads()}/${created.id}`).set(admin.auth).send({ notes: "Звонить" }).expect(200);

    expect((await activity(created.id)).body.map((entry: { kind: string }) => entry.kind)).toEqual(["created"]);
  });

  it("starts an imported lead with its arrival from Meta, naming no member", async () => {
    const lead = await prisma.lead.create({ data: {
      name: "Анна", orgId: (await currentOrg()).id, projectId, origin: "META",
      metaSource: { create: {
        accountId: "123", formId: "f1", campaignExternalId: "c1", campaignName: "Весна",
        adSetExternalId: "s1", adSetName: "Москва", adExternalId: "555", adName: "Видео 1",
        submittedAt: new Date("2026-09-10T10:00:00Z"), answers: [],
      } },
    } });

    expect((await activity(lead.id)).body).toEqual([
      { id: `imported-${lead.id}`, kind: "imported", actor: null, at: "2026-09-10T10:00:00.000Z" },
    ]);
  });

  it("answers 404 for a lead on a board the member cannot reach, or on another board", async () => {
    const created = (await request(app).post(leads()).set(admin.auth).send({ name: "Леонид" })).body;
    const other = await prisma.project.create({ data: { clientId, name: "Второй", position: 1 } });
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId, other.id);

    expect((await activity(created.id, projectId, manager.auth)).status).toBe(404);
    expect((await activity(created.id, other.id)).status).toBe(404);
  });
});
