import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let manager: SignedIn;
let guest: SignedIn;
let wholeClient: SignedIn;
let siteOnly: SignedIn;
let shopOnly: SignedIn;
let clientId: string;
let siteId: string;
let shopId: string;

beforeEach(async () => {
  await resetDb();
  await signInAs("Admin", { role: "ADMIN" });
  const org = await currentOrg();
  const client = await prisma.client.create({ data: { name: "Acme", orgId: org.id } });
  clientId = client.id;
  siteId = (await prisma.project.create({ data: { clientId, name: "Сайт", position: 0 } })).id;
  shopId = (await prisma.project.create({ data: { clientId, name: "Магазин", position: 1 } })).id;
  manager = await signInAs("Manager", { role: "MANAGER" });
  guest = await signInAs("Guest", { role: "GUEST" });
  wholeClient = await signInAs("Principal", { role: "CLIENT_ADMIN" });
  siteOnly = await signInAs("Site", { role: "CLIENT" });
  shopOnly = await signInAs("Shop", { role: "CLIENT" });
  await grantAccess(guest.membership!.id, clientId);
  await grantAccess(wholeClient.membership!.id, clientId);
  await grantAccess(siteOnly.membership!.id, clientId, siteId);
  await grantAccess(shopOnly.membership!.id, clientId, shopId);
});
afterAll(() => prisma.$disconnect());

const names = (body: { name: string }[]) => body.map((member) => member.name).sort();

describe("a client's people, listed to a manager", () => {
  it("are everyone granted the client or one of its projects", async () => {
    const res = await request(app).get(`/api/members?clientId=${clientId}`).set(manager.auth);
    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(["Guest", "Principal", "Shop", "Site"]);
  });

  it("are narrowed to those who reach one project", async () => {
    const res = await request(app).get(`/api/members?clientId=${clientId}&projectId=${siteId}`).set(manager.auth);
    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(["Guest", "Principal", "Site"]);
  });

  it("are refused to a guest -> 403", async () => {
    expect((await request(app).get(`/api/members?clientId=${clientId}`).set(guest.auth)).status).toBe(403);
  });
});
