import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Role } from "@adpulse/access-policy";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();

type Auth = { Authorization: string };

let admin: Auth;
let userId: string;
let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs("Admin", { role: "ADMIN" });
  admin = signedIn.auth;
  userId = signedIn.user.id;
  ({ clientId, projectId } = await seedProject(signedIn.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

const keyOf = (id = projectId) => `/api/projects/${id}/website-key`;
const issue = (auth: Auth = admin) => request(app).put(keyOf()).set(auth);
const allow = (sites: string[], auth: Auth = admin) => request(app).put(`${keyOf()}/sites`).set(auth).send({ sites });
const memberWith = async (role: Role) => {
  const member = await signInAs(role, { role });
  await grantAccess(member.membership!.id, clientId);
  return member.auth;
};
let visitor = 0;
const send = (key: string, body: Record<string, unknown>, origin = "https://shop.example.com", address = `10.0.${Math.floor(++visitor / 250)}.${visitor % 250}`) =>
  request(app).post("/api/intake/leads").set("X-Forwarded-For", address).set("Origin", origin).set("Content-Type", "text/plain").send(JSON.stringify({ key, ...body }));
const ready = async (sites = ["example.com"]) => {
  const { key } = (await issue()).body;
  await allow(sites);
  return key as string;
};

describe("a project's website key", () => {
  it("does not exist until a member who manages the project creates it", async () => {
    expect((await request(app).get(keyOf()).set(admin)).body).toBeNull();

    const created = await issue();

    expect(created.status).toBe(201);
    expect(created.body.key).toMatch(/^bk_[A-Za-z0-9_-]{32}$/);
    expect(created.body.allowedSites).toEqual([]);
  });

  it("stays one key when it is created again", async () => {
    const { key } = (await issue()).body;

    const again = await issue();

    expect(again.status).toBe(200);
    expect(again.body.key).toBe(key);
  });

  it("is managed by a manager and hidden from other roles", async () => {
    const manager = await memberWith("MANAGER");
    expect((await issue(manager)).status).toBe(201);
    const guest = await memberWith("GUEST");
    expect((await request(app).get(keyOf()).set(guest)).status).toBe(403);
    expect((await issue(guest)).status).toBe(403);
  });

  it("stops the old key when it is rotated", async () => {
    const old = await ready();

    const rotated = await request(app).post(`${keyOf()}/rotate`).set(admin);

    expect(rotated.status).toBe(200);
    expect(rotated.body.key).not.toBe(old);
    expect((await send(old, { name: "Anna" })).status).toBe(403);
    expect((await send(rotated.body.key, { name: "Anna" })).status).toBe(202);
  });

  it("keeps host names only, without duplicates", async () => {
    await issue();

    const res = await allow(["https://Shop.Example.com/path", "shop.example.com", "example.org"]);

    expect(res.body.allowedSites).toEqual(["shop.example.com", "example.org"]);
    expect((await allow(["not a host"])).status).toBe(400);
  });

  it("is removed on request", async () => {
    const key = await ready();

    expect((await request(app).delete(keyOf()).set(admin)).status).toBe(204);
    expect((await send(key, { name: "Anna" })).status).toBe(403);
  });
});

describe("a lead sent from a website", () => {
  it("lands in the first column with the website origin, contact and tags", async () => {
    const key = await ready();

    const res = await send(key, {
      id: "form-1", name: "Анна", phone: "+375 29 123-45-67", email: "anna@example.com",
      utm_source: "facebook", utm_medium: "cpc", utm_campaign: "spring", utm_content: "ad-1", utm_term: "windows",
      page_url: "https://shop.example.com/offer", referrer: "https://l.facebook.com/",
      fields: [{ question: "Комментарий", value: "Нужен замер" }],
    });

    expect(res.status).toBe(202);
    expect(res.headers["access-control-allow-origin"]).toBe("https://shop.example.com");
    const list = await request(app).get(`/api/crm/boards/${projectId}/leads`).set(admin);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      name: "Анна", origin: "WEBSITE", stage: "NEW", metaSource: null,
      person: { phone: "+375 29 123-45-67", email: "anna@example.com" },
      webSource: {
        utmSource: "facebook", utmMedium: "cpc", utmCampaign: "spring", utmContent: "ad-1", utmTerm: "windows",
        pageUrl: "https://shop.example.com/offer", referrer: "https://l.facebook.com/",
        answers: [{ question: "Комментарий", values: ["Нужен замер"] }],
      },
    });
  });

  it("is named after its phone when the form has no name", async () => {
    const key = await ready();

    await send(key, { phone: "+375291234567" });

    expect((await prisma.lead.findFirstOrThrow()).name).toBe("+375291234567");
  });

  it("is accepted from a subdomain of an allowed site only", async () => {
    const key = await ready(["example.com"]);

    expect((await send(key, { name: "A" }, "https://www.example.com")).status).toBe(202);
    expect((await send(key, { name: "B" }, "https://example.com.evil.net")).status).toBe(403);
    expect((await send(key, { name: "C" }, "https://other.org")).status).toBe(403);
    expect(await prisma.lead.count()).toBe(1);
  });

  it("gives no cross-origin permission to a site that is not allowed", async () => {
    const key = await ready();

    const res = await send(key, { name: "A" }, "https://other.org");

    expect(res.status).toBe(403);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("is refused when the key list is empty", async () => {
    const key = await ready([]);

    expect((await send(key, { name: "A" })).status).toBe(403);
  });

  it("is accepted from a server that sends the key as a bearer token", async () => {
    const key = await ready();

    const res = await request(app).post("/api/intake/leads").set("Authorization", `Bearer ${key}`).send({ name: "Server" });

    expect(res.status).toBe(202);
    expect(await prisma.lead.count()).toBe(1);
  });

  it("is refused without an origin or a bearer token", async () => {
    const key = await ready();

    expect((await request(app).post("/api/intake/leads").send({ key, name: "A" })).status).toBe(403);
  });

  it("creates one lead when the same submission arrives twice", async () => {
    const key = await ready();

    await send(key, { id: "same", name: "Anna" });
    await send(key, { id: "same", name: "Anna" });

    expect(await prisma.lead.count()).toBe(1);
  });

  it("creates nothing when the honeypot is filled, and still answers success", async () => {
    const key = await ready();

    const res = await send(key, { name: "Bot", hp: "http://spam" });

    expect(res.status).toBe(202);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("is refused when the key is malformed or unknown", async () => {
    expect((await send("nope", { name: "A" })).status).toBe(403);
    expect((await send(`bk_${"a".repeat(32)}`, { name: "A" })).status).toBe(403);
  });

  it("answers a preflight request for the site that asks", async () => {
    const res = await request(app).options("/api/intake/leads").set("Origin", "https://shop.example.com");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://shop.example.com");
  });

  it("refuses a visitor who sends too many leads in a minute", async () => {
    const key = await ready();
    const statuses: number[] = [];

    for (let index = 0; index < 22; index += 1) {
      statuses.push((await send(key, { id: `lead-${index}`, name: "Anna" }, "https://shop.example.com", "203.0.113.9")).status);
    }

    expect(statuses.slice(0, 20).every((status) => status === 202)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
  });

  it("reuses the contact person for a repeated phone", async () => {
    const key = await ready();

    await send(key, { id: "a", name: "Anna", phone: "+375291234567" });
    await send(key, { id: "b", name: "Anna", phone: "+375 29 123 45 67" });

    expect(await prisma.lead.count()).toBe(2);
    expect(await prisma.person.count()).toBe(1);
  });
});

describe("the campaign of a website lead", () => {
  it("is found by the Meta id in utm_campaign", async () => {
    const key = await ready();
    const campaign = await prisma.campaign.update({ where: { id: (await seedCampaign(projectId, "Spring", "META")).id }, data: { externalId: "120001" } });

    await send(key, { name: "A", utm_campaign: "120001" });

    expect((await prisma.lead.findFirstOrThrow()).campaignId).toBe(campaign.id);
  });

  it("is found by the name, ignoring case and spaces", async () => {
    const key = await ready();
    const campaign = await seedCampaign(projectId, "Spring Sale");

    await send(key, { name: "A", utm_campaign: "  spring sale " });

    expect((await prisma.lead.findFirstOrThrow()).campaignId).toBe(campaign.id);
  });

  it("stays empty when no campaign or several campaigns match, and the tag is kept", async () => {
    const key = await ready();
    await seedCampaign(projectId, "Twin");
    await seedCampaign(projectId, "twin");

    await send(key, { id: "x", name: "A", utm_campaign: "Twin" });
    await send(key, { id: "y", name: "B", utm_campaign: "unknown" });

    const leads = await prisma.lead.findMany({ include: { webSource: true } });
    expect(leads.map((lead) => lead.campaignId)).toEqual([null, null]);
    expect(leads.map((lead) => lead.webSource?.utmCampaign).sort()).toEqual(["Twin", "unknown"]);
  });

  it("is not taken from another project", async () => {
    const key = await ready();
    const other = await seedProject(userId, "Other");
    await seedCampaign(other.projectId, "Spring");

    await send(key, { name: "A", utm_campaign: "Spring" });

    expect((await prisma.lead.findFirstOrThrow()).campaignId).toBeNull();
  });
});

describe("the site script", () => {
  it("is served as JavaScript without a session", async () => {
    const res = await request(app).get("/api/intake/script.js");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
    expect(res.text).toContain("balagan_utm");
  });
});
