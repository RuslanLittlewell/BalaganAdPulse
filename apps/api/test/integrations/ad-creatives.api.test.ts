import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject, seedCampaign } from "../helpers/db.js";
import { signInAs, signInAsOutsider } from "../helpers/auth.js";
import { GraphProvider } from "../../src/modules/integrations/infrastructure/graph-provider.js";
import { AesCredentialCipher } from "../../src/modules/integrations/infrastructure/credential-cipher.js";
import { S3CreativeFiles } from "../../src/modules/integrations/infrastructure/creative-files.js";

const app = createApp();

let auth: { Authorization: string };
let projectId: string;
let adId: string;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  ({ auth } = member);
  ({ projectId } = await seedProject(member.user.id));
  const campaign = await seedCampaign(projectId);
  const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Группа", position: 0 } });
  const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Объявление", externalId: "555", position: 0 } });
  adId = ad.id;
});
afterAll(async () => { await prisma.$disconnect(); });

async function connect() {
  await prisma.projectIntegration.create({
    data: {
      projectId, accountId: "123", currency: "BYN", timezone: "UTC",
      encryptedToken: new AesCredentialCipher(process.env.INTEGRATION_ENCRYPTION_KEY).encrypt("token", projectId),
      revision: "v1", nextDailyAt: new Date(),
    },
  });
}

const anImage = [{
  adExternalId: "555", creativeId: "c1", position: 0, kind: "IMAGE" as const,
  title: "Баннер", fileUrl: "https://cdn.invalid/one.jpg",
}];

describe("Ad creatives on demand", () => {
  it("fetches an ad's creatives the first time they are asked for, and stores them", async () => {
    await connect();
    const read = vi.spyOn(GraphProvider.prototype, "adCreatives").mockResolvedValue(anImage);
    const copied = vi.spyOn(S3CreativeFiles.prototype, "copy")
      .mockResolvedValue({ key: "creatives/one", contentType: "image/jpeg", bytes: 2048 });

    const res = await request(app).get(`/api/ads/${adId}/creatives`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{
      id: expect.any(String), position: 0, kind: "IMAGE",
      title: "Баннер", body: null, hasFile: true, hasPoster: false,
    }]);
    expect(JSON.stringify(res.body)).not.toContain("creatives/one");
    expect(await prisma.adCreative.count()).toBe(1);
    read.mockRestore();
    copied.mockRestore();
  });

  it("serves the stored creatives afterwards without asking the provider", async () => {
    await connect();
    await prisma.adCreative.create({
      data: { adId, externalId: "c1", position: 0, kind: "IMAGE", fileKey: "creatives/one" },
    });
    const read = vi.spyOn(GraphProvider.prototype, "adCreatives").mockResolvedValue(anImage);

    const res = await request(app).get(`/api/ads/${adId}/creatives`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  });

  it("answers with what is stored when the project has no connection", async () => {
    const res = await request(app).get(`/api/ads/${adId}/creatives`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("answers 404 for an ad the member may not reach", async () => {
    await connect();
    const outsider = await signInAsOutsider();
    expect((await request(app).get(`/api/ads/${adId}/creatives`).set(outsider.auth)).status).toBe(404);
  });

  it("refuses an anonymous caller", async () => {
    expect((await request(app).get(`/api/ads/${adId}/creatives`)).status).toBe(401);
  });
});
