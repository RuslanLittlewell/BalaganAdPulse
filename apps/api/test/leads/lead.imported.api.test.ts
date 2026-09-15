import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

const app = createApp();

let auth: { Authorization: string };
let clientId: string;
let projectId: string;
let campaignId: string;
let adId: string;
let leadId: string;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  auth = member.auth;
  ({ clientId, projectId } = await seedProject(member.user.id));
  const campaign = await seedCampaign(projectId, "Весна", "META");
  campaignId = campaign.id;
  const adSet = await prisma.adSet.create({ data: { campaignId, name: "Москва", externalId: "s1", position: 0 } });
  const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Видео 1", externalId: "555", position: 0 } });
  adId = ad.id;
  const lead = await prisma.lead.create({
    data: {
      name: "Анна", phone: "+375291234567", orgId: (await currentOrg()).id, clientId, projectId, campaignId, adId,
      origin: "META",
      metaSource: {
        create: {
          accountId: "123", formId: "f1",
          campaignExternalId: "c1", campaignName: "Весна",
          adSetExternalId: "s1", adSetName: "Москва",
          adExternalId: "555", adName: "Видео 1",
          submittedAt: new Date("2026-09-10T10:00:00Z"),
          answers: [{ question: "full_name", values: ["Анна"] }, { question: "budget", values: ["1000"] }],
          answersOmitted: true,
        },
      },
    },
  });
  leadId = lead.id;
});

afterAll(() => prisma.$disconnect());

const leads = (board: string) => `/api/crm/boards/${board}/leads`;

const importedShape = () => ({
  origin: "META",
  projectId, campaignId,
  ad: { id: adId, name: "Видео 1", externalId: "555" },
  metaSource: {
    accountId: "123", formId: "f1",
    campaign: { externalId: "c1", name: "Весна" },
    adSet: { externalId: "s1", name: "Москва" },
    ad: { externalId: "555", name: "Видео 1" },
    submittedAt: "2026-09-10T10:00:00.000Z",
    answers: [{ question: "full_name", values: ["Анна"] }, { question: "budget", values: ["1000"] }],
    answersOmitted: true,
  },
});

describe("an imported lead", () => {
  it("carries its origin, ad and Meta source in reads and listings", async () => {
    const read = await request(app).get(`${leads(clientId)}/${leadId}`).set(auth);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject(importedShape());

    const listed = await request(app).get(leads(clientId)).set(auth);
    expect(listed.body).toEqual([expect.objectContaining(importedShape())]);
  });

  it("reads a hand-made lead with no ad and no Meta source", async () => {
    const created = await request(app).post(leads(clientId)).set(auth).send({ name: "Вручную" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ origin: "MANUAL", ad: null, metaSource: null });
  });

  it("refuses a different campaign", async () => {
    const other = await seedCampaign(projectId, "Осень", "META");

    const updated = await request(app).patch(`${leads(clientId)}/${leadId}`).set(auth).send({ campaignId: other.id });

    expect(updated.status).toBe(400);
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).toMatchObject({ campaignId, adId });
  });

  it("refuses a different or cleared project", async () => {
    const other = await seedProject("unused", "Другой");
    await prisma.project.update({ where: { id: other.projectId }, data: { clientId } });

    expect((await request(app).patch(`${leads(clientId)}/${leadId}`).set(auth).send({ projectId: other.projectId })).status).toBe(400);
    expect((await request(app).patch(`${leads(clientId)}/${leadId}`).set(auth).send({ projectId: null })).status).toBe(400);
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).toMatchObject({ projectId, campaignId, adId });
  });

  it("accepts a save repeating its project and campaign and keeps the ad", async () => {
    const updated = await request(app).patch(`${leads(clientId)}/${leadId}`).set(auth)
      .send({ projectId, campaignId, notes: "Перезвонить", phone: "+375290000000" });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ ...importedShape(), notes: "Перезвонить", phone: "+375290000000" });
  });

  it("keeps the source out of reach of the lead API", async () => {
    const attempts = [{ origin: "MANUAL" }, { adId: null }, { metaSource: null }];
    for (const body of attempts) {
      expect((await request(app).patch(`${leads(clientId)}/${leadId}`).set(auth).send(body)).status).toBe(400);
    }
    expect((await request(app).post(leads(clientId)).set(auth).send({ name: "Подделка", origin: "META" })).status).toBe(400);
    expect(await prisma.leadMetaSource.count()).toBe(1);
  });

  it("keeps its ad and source through a move", async () => {
    const moved = await request(app).patch(`${leads(clientId)}/${leadId}/move`).set(auth).send({ stage: "QUALIFIED", position: 0 });

    expect(moved.status).toBe(200);
    expect(moved.body).toEqual([expect.objectContaining({ ...importedShape(), stage: "QUALIFIED" })]);
  });
});
