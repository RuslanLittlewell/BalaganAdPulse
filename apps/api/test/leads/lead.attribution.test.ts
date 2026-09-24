import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();

let auth: { Authorization: string };
let projectId: string;
let campaignId: string;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  auth = member.auth;
  ({ projectId } = await seedProject(member.user.id));
  campaignId = (await seedCampaign(projectId)).id;
});

afterAll(() => prisma.$disconnect());

const leads = (board = projectId) => `/api/crm/boards/${board}/leads`;

const create = (body: Record<string, unknown>, board = projectId) =>
  request(app).post(leads(board)).set(auth).send({ name: "Lead", ...body });

describe("the campaign a lead came from", () => {
  it("stores the campaign a lead is attributed to, on the board's project", async () => {
    const created = await create({ campaignId });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ projectId, campaignId });
    expect((await request(app).get(`${leads()}/${created.body.id}`).set(auth)).body)
      .toMatchObject({ projectId, campaignId });
  });

  it("leaves the campaign empty when the lead is not attributed to one", async () => {
    const created = await create({});
    expect(created.body).toMatchObject({ projectId, campaignId: null });
  });

  it("refuses a campaign that belongs to another project", async () => {
    const other = await seedProject("unused", "Other");
    const elsewhere = await seedCampaign(other.projectId, "Elsewhere");

    expect((await create({ campaignId: elsewhere.id })).status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("keeps the campaign after an unrelated edit", async () => {
    const created = await create({ campaignId });

    const updated = await request(app).patch(`${leads()}/${created.body.id}`)
      .set(auth).send({ company: "Acme" });

    expect(updated.body).toMatchObject({ projectId, campaignId, company: "Acme" });
  });

  it("leaves a lead standing with no campaign when its campaign is deleted", async () => {
    const created = await create({ campaignId });

    await prisma.campaign.delete({ where: { id: campaignId } });

    const read = await request(app).get(`${leads()}/${created.body.id}`).set(auth);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ projectId, campaignId: null });
  });

  it("clears the campaign when asked to", async () => {
    const created = await create({ campaignId });

    const updated = await request(app).patch(`${leads()}/${created.body.id}`)
      .set(auth).send({ campaignId: null });

    expect(updated.body).toMatchObject({ projectId, campaignId: null });
  });
});
