import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();

let admin: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs("Admin", { role: "ADMIN" });
  admin = signedIn.auth;
  ({ projectId } = await seedProject(signedIn.user.id, "Window Hub"));
});
afterAll(() => prisma.$disconnect());

const keyPath = () => `/api/projects/${projectId}/website-key`;
const issue = async () => (await request(app).put(keyPath()).set(admin)).body.key as string;
const deliver = (key: string, body: unknown, contentType = "application/json") =>
  request(app).post(`/api/intake/marquiz/${key}`).set("Content-Type", contentType).send(typeof body === "string" ? body : JSON.stringify(body));
const leads = async () => (await request(app).get(`/api/crm/boards/${projectId}/leads`).set(admin)).body;

const submission = {
  answers: [
    { q: "Are you replacing existing windows?*", a: "For replacement" },
    { q: "How many windows do you need?", a: "5+ windows" },
    { q: "What stage are you at?", a: "I want to know the price" },
  ],
  contacts: { name: "Karl Lauster", email: "karl@example.com", phone: "+15125550181" },
  quiz: { id: "600920a2de60d9004900edb9", name: "Window price quiz" },
  created: "2026-11-24T10:23:25.796Z",
  extra: { href: "https://windowhub.pro/", referrer: "https://l.facebook.com/", utm: { source: "facebook", medium: "cpc", campaign: "spring" } },
};

describe("a Marquiz webhook", () => {
  it("creates a website lead in the first column with the contacts, answers, quiz name and tags", async () => {
    const key = await issue();

    const res = await deliver(key, submission);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const list = await leads();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: "Karl Lauster", origin: "WEBSITE", stage: "NEW",
      person: { phone: "+15125550181", email: "karl@example.com" },
      webSource: {
        utmSource: "facebook", utmMedium: "cpc", utmCampaign: "spring",
        pageUrl: "https://windowhub.pro/", referrer: "https://l.facebook.com/",
        answers: [
          { question: "Are you replacing existing windows?", values: ["For replacement"] },
          { question: "How many windows do you need?", values: ["5+ windows"] },
          { question: "What stage are you at?", values: ["I want to know the price"] },
          { question: "Квиз", values: ["Window price quiz"] },
        ],
      },
    });
  });

  it("links the lead to the campaign named in utm_campaign", async () => {
    const key = await issue();
    const campaign = await seedCampaign(projectId, "Spring", "META");

    await deliver(key, submission);

    expect((await prisma.lead.findFirstOrThrow()).campaignId).toBe(campaign.id);
  });

  it("creates one lead when Marquiz delivers the same submission twice", async () => {
    const key = await issue();

    expect((await deliver(key, submission)).status).toBe(200);
    expect((await deliver(key, submission)).status).toBe(200);

    expect(await prisma.lead.count()).toBe(1);
  });

  it("is accepted while the key allows no site, whatever the origin header says", async () => {
    const key = await issue();

    const res = await request(app).post(`/api/intake/marquiz/${key}`).set("Origin", "https://marquiz.io").set("Content-Type", "text/plain").send(JSON.stringify(submission));

    expect(res.status).toBe(200);
    expect(await prisma.lead.count()).toBe(1);
  });

  it("is refused at the address of a rotated key", async () => {
    const old = await issue();
    await request(app).post(`${keyPath()}/rotate`).set(admin);

    const res = await deliver(old, submission);

    expect(res.status).toBe(403);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("is refused at an address with a malformed or unknown key, without telling them apart", async () => {
    const malformed = await deliver("not-a-key", submission);
    const unknown = await deliver(`bk_${"a".repeat(32)}`, submission);

    expect(malformed.status).toBe(403);
    expect(unknown.status).toBe(403);
    expect(malformed.body.error.message).toBe(unknown.body.error.message);
  });

  it("refuses a body that is not JSON or holds neither contacts nor answers", async () => {
    const key = await issue();

    expect((await deliver(key, "name=Karl", "application/x-www-form-urlencoded")).status).toBe(400);
    expect((await deliver(key, { quiz: { name: "Window price quiz" } })).status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("refuses requests above the key's limit", async () => {
    const key = await issue();
    const statuses: number[] = [];

    for (let index = 0; index < 302; index += 1) {
      statuses.push((await deliver(key, { quiz: { name: "empty" } })).status);
    }

    expect(statuses.slice(0, 300).every((status) => status === 400)).toBe(true);
    expect(statuses.slice(300)).toEqual([429, 429]);
  });
});
