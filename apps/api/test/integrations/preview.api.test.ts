import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject, seedCampaign } from "../helpers/db.js";
import { signInAs, signInAsOutsider } from "../helpers/auth.js";
import { GraphProvider } from "../../src/modules/integrations/infrastructure/graph-provider.js";
import { AesCredentialCipher } from "../../src/modules/integrations/infrastructure/credential-cipher.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

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
      encryptedToken: new AesCredentialCipher(process.env.INTEGRATION_ENCRYPTION_KEY).encrypt("secret-token", projectId),
      revision: "v1", nextDailyAt: new Date(),
    },
  });
}

describe("Ad preview API", () => {
  it("hands back the provider's rendered frame for a reachable ad", async () => {
    await connect();
    const rendered = vi.spyOn(GraphProvider.prototype, "preview")
      .mockResolvedValue("https://business.facebook.com/ads/api/preview_iframe.php?d=AQ");

    const res = await request(app).get(`/api/ads/${adId}/preview`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: "https://business.facebook.com/ads/api/preview_iframe.php?d=AQ" });
    expect(JSON.stringify(res.body)).not.toContain("secret-token");
    rendered.mockRestore();
  });

  it("answers 404 when the project has no connection", async () => {
    expect((await request(app).get(`/api/ads/${adId}/preview`).set(auth)).status).toBe(404);
  });

  it("answers 404 when the provider will not render the ad", async () => {
    await connect();
    const rendered = vi.spyOn(GraphProvider.prototype, "preview").mockResolvedValue(null);

    expect((await request(app).get(`/api/ads/${adId}/preview`).set(auth)).status).toBe(404);
    rendered.mockRestore();
  });

  it("answers 404 for an ad the member may not reach", async () => {
    await connect();
    const outsider = await signInAsOutsider();
    expect((await request(app).get(`/api/ads/${adId}/preview`).set(outsider.auth)).status).toBe(404);
  });

  it("answers 404 for an unknown ad", async () => {
    expect((await request(app).get(`/api/ads/${MISSING}/preview`).set(auth)).status).toBe(404);
  });

  it("refuses an anonymous caller", async () => {
    expect((await request(app).get(`/api/ads/${adId}/preview`)).status).toBe(401);
  });
});
