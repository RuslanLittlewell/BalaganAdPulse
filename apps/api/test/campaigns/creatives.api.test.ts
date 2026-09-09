import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { putObject } from "../../src/shared/infrastructure/storage.js";
import { resetDb, seedProject, seedCampaign } from "../helpers/db.js";
import { signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";
const png = Buffer.from("89504e470d0a1a0a", "hex");

let auth: { Authorization: string };
let adSetId: string;
let adId: string;

async function creative(data: Record<string, unknown> = {}) {
  return prisma.adCreative.create({
    data: {
      adId, externalId: "c1", position: 0, kind: "IMAGE",
      title: "Заголовок", body: "Текст",
      fileKey: "creatives/test-file", contentType: "image/png", bytes: png.length,
      ...data,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  ({ auth } = member);
  const { projectId } = await seedProject(member.user.id);
  const campaign = await seedCampaign(projectId);
  const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Группа", position: 0 } });
  adSetId = adSet.id;
  const ad = await prisma.ad.create({ data: { adSetId, name: "Объявление", position: 0 } });
  adId = ad.id;
  await putObject("creatives/test-file", png, "image/png");
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Ad creatives API", () => {
  it("does not load creative metadata while listing an ad set's ads", async () => {
    await creative();

    const res = await request(app).get(`/api/ad-sets/${adSetId}/ads`).set(auth)
      .query({ from: "2026-09-01", to: "2026-09-08" });

    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty("creatives");
    expect(JSON.stringify(res.body)).not.toContain("creatives/test-file");
  });

  it("serves the stored file with its own content type", async () => {
    const stored = await creative();

    const res = await request(app).get(`/api/ad-creatives/${stored.id}/file`).set(auth);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(Buffer.from(res.body)).toEqual(png);
  });

  it("serves a video's poster separately", async () => {
    const stored = await creative({
      kind: "VIDEO", fileKey: null, contentType: null,
      posterKey: "creatives/test-file", posterContentType: "image/png",
    });

    expect((await request(app).get(`/api/ad-creatives/${stored.id}/poster`).set(auth)).status).toBe(200);
    expect((await request(app).get(`/api/ad-creatives/${stored.id}/file`).set(auth)).status).toBe(404);
  });

  it("answers 404 for a creative of a project the member may not reach", async () => {
    const stored = await creative();
    const outsider = await signInAsOutsider();

    const res = await request(app).get(`/api/ad-creatives/${stored.id}/file`).set(outsider.auth);

    expect(res.status).toBe(404);
  });

  it("answers 404 for a creative that does not exist", async () => {
    expect((await request(app).get(`/api/ad-creatives/${MISSING}/file`).set(auth)).status).toBe(404);
  });

  it("refuses an anonymous caller", async () => {
    const stored = await creative();
    expect((await request(app).get(`/api/ad-creatives/${stored.id}/file`)).status).toBe(401);
  });
});
