import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

let auth: { Authorization: string };
let clientId: string;
let projectId: string;
let campaignId: string;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  auth = member.auth;
  const seeded = await seedProject(member.user.id);
  clientId = seeded.clientId;
  projectId = seeded.projectId;
  campaignId = (await seedCampaign(projectId)).id;
});

afterAll(() => prisma.$disconnect());

const leads = (board = "agency") => `/api/crm/boards/${board}/leads`;

const create = (body: Record<string, unknown>, board = "agency") =>
  request(app).post(leads(board)).set(auth).send({ name: "Lead", ...body });

describe("where a lead came from", () => {
  it("stores the project and campaign a lead is attributed to", async () => {
    const created = await create({ projectId, campaignId });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ projectId, campaignId });
    expect((await request(app).get(`${leads()}/${created.body.id}`).set(auth)).body)
      .toMatchObject({ projectId, campaignId });
  });

  it("leaves both empty when the lead is not attributed to anything", async () => {
    const created = await create({});
    expect(created.body).toMatchObject({ projectId: null, campaignId: null });
  });

  it("refuses a campaign that belongs to another project", async () => {
    const other = await seedProject("unused", "Other");
    const elsewhere = await seedCampaign(other.projectId, "Elsewhere");

    expect((await create({ projectId, campaignId: elsewhere.id })).status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("refuses a campaign named without a project", async () => {
    expect((await create({ campaignId })).status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("refuses a project of another client on a client's own board", async () => {
    const other = await seedProject("unused", "Other");

    expect((await create({ projectId: other.projectId }, clientId)).status).toBe(404);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("accepts any project of the organization on the agency board", async () => {
    const other = await seedProject("unused", "Other");

    expect((await create({ projectId: other.projectId })).status).toBe(201);
  });

  it("refuses a project of another organization", async () => {
    const outsider = await signInAsOutsider();
    const theirs = await prisma.project.create({
      data: { clientId: outsider.client.id, name: "Theirs", position: 0 },
    });

    expect((await create({ projectId: theirs.id })).status).toBe(404);
  });

  it("releases a campaign that no longer belongs to the lead's project", async () => {
    const created = await create({ projectId, campaignId });
    const other = await seedProject("unused", "Other");

    const updated = await request(app).patch(`${leads()}/${created.body.id}`)
      .set(auth).send({ projectId: other.projectId });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ projectId: other.projectId, campaignId: null });
  });

  it("keeps a campaign that still belongs to the project after an unrelated edit", async () => {
    const created = await create({ projectId, campaignId });

    const updated = await request(app).patch(`${leads()}/${created.body.id}`)
      .set(auth).send({ company: "Acme" });

    expect(updated.body).toMatchObject({ projectId, campaignId, company: "Acme" });
  });

  it("leaves a lead standing when the project it named is deleted", async () => {
    const created = await create({ projectId, campaignId });

    await prisma.project.delete({ where: { id: projectId } });

    const read = await request(app).get(`${leads()}/${created.body.id}`).set(auth);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ projectId: null, campaignId: null });
  });

  it("clears an attribution when asked to", async () => {
    const created = await create({ projectId, campaignId });

    const updated = await request(app).patch(`${leads()}/${created.body.id}`)
      .set(auth).send({ projectId: null, campaignId: null });

    expect(updated.body).toMatchObject({ projectId: null, campaignId: null });
  });

  it("no longer carries a Telegram of its own", async () => {
    expect((await create({ telegram: "@lead" })).status).toBe(400);
  });
});
