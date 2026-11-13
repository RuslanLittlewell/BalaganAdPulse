import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let boss: SignedIn;
let clientId: string;
let projectId: string;
let campaignId: string;

beforeEach(async () => {
  resetIdentityRateLimits();
  await resetDb();
  admin = await signInAs();
  ({ clientId, projectId } = await seedProject(admin.user.id, "Gealan"));
  campaignId = (await seedCampaign(projectId, "Север — окна ПВХ", "META")).id;
  boss = await principal();
});

afterAll(() => prisma.$disconnect());

async function principal(client: string = clientId) {
  const member = await signInAs("Gealan Principal", { role: "CLIENT_ADMIN" });
  await grantAccess(member.membership!.id, client);
  return member;
}

const invite = (as: SignedIn, body: object = {}) =>
  request(app).post("/api/invites").set(as.auth).send({ registrationType: "PARTNER", campaignId, ...body });
const codeOf = (body: { registrationUrl: string }) => body.registrationUrl.split("/").pop()!;
const register = (code: string, email: string, extra: object = {}) =>
  request(app).post("/api/auth/register").send({ name: "Дилер", email, password: "hunter2hunter2", inviteCode: code, ...extra });
const join = async (email: string, as: SignedIn = boss) => {
  await register(codeOf((await invite(as).expect(201)).body), email).expect(201);
  return prisma.membership.findFirstOrThrow({ where: { user: { email } } });
};

describe("partner invitations", () => {
  it("bind the person who registers to one campaign with the partner role", async () => {
    const invited = await invite(boss, { email: "dealer@north.by" }).expect(201);
    expect(invited.body).toMatchObject({ registrationType: "PARTNER", campaignId, clientId, role: null, email: "dealer@north.by" });

    const resolved = await request(app).get(`/api/registration/${codeOf(invited.body)}`).expect(200);
    expect(resolved.body).toMatchObject({ registrationType: "PARTNER" });

    await register(codeOf(invited.body), "dealer@north.by").expect(201);
    const membership = await prisma.membership.findFirstOrThrow({ where: { user: { email: "dealer@north.by" } } });
    expect(membership).toMatchObject({ role: "PARTNER", campaignId });
    expect(await prisma.clientAccess.count({ where: { membershipId: membership.id } })).toBe(0);
  });

  it("are issued by an admin and the client's principal and refused to managers, guests and the client's people", async () => {
    await invite(admin).expect(201);
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId, projectId);
    const staff = await signInAs("Staff", { role: "CLIENT" });
    await grantAccess(staff.membership!.id, clientId);
    for (const member of [manager, guest, staff]) await invite(member).expect(403);
  });

  it("answer not found for a campaign of another client and refuse a role, projects, a client or no campaign", async () => {
    const otherClient = await prisma.client.create({ data: { name: "Другой клиент", orgId: (await currentOrg()).id } });
    await invite(await principal(otherClient.id)).expect(404);
    await invite(boss, { campaignId: undefined }).expect(400);
    await invite(boss, { role: "MANAGER" }).expect(400);
    await invite(boss, { projectIds: [projectId] }).expect(400);
    await invite(boss, { clientId }).expect(400);
    await request(app).post("/api/invites").set(boss.auth).send({ registrationType: "CLIENT_STAFF", clientId, campaignId }).expect(400);
    expect(await prisma.invite.count()).toBe(0);
  });

  it("store nothing when a redemption is refused and keep the link working", async () => {
    const code = codeOf((await invite(boss).expect(201)).body);
    await register(code, "dealer@north.by", { client: { name: "Лишнее" }, project: { name: "Лишний" } }).expect(400);
    expect(await prisma.user.count({ where: { email: "dealer@north.by" } })).toBe(0);
    await register(code, "dealer@north.by").expect(201);
  });

  it("are bound to an email, spent once, and refused once expired or revoked", async () => {
    const code = codeOf((await invite(boss, { email: "dealer@north.by", expiresInDays: 1 }).expect(201)).body);
    await register(code, "stranger@north.by").expect(403);
    expect(await prisma.user.count({ where: { email: "stranger@north.by" } })).toBe(0);
    await register(code, "dealer@north.by").expect(201);
    await register(code, "again@north.by").expect(403);

    const expired = (await invite(boss).expect(201)).body;
    await prisma.invite.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } });
    await request(app).get(`/api/registration/${codeOf(expired)}`).expect(404);
    await register(codeOf(expired), "late@north.by").expect(403);

    const revoked = (await invite(boss).expect(201)).body;
    await request(app).delete(`/api/invites/${revoked.id}`).set(boss.auth).expect(204);
    await register(codeOf(revoked), "revoked@north.by").expect(403);
  });
});

describe("partner people", () => {
  it("are listed among the client's people with their campaign, narrowed by project", async () => {
    const dealer = await join("dealer@north.by");
    const people = (await request(app).get(`/api/members?clientId=${clientId}`).set(boss.auth).expect(200)).body as Array<{ id: string; campaign: unknown }>;
    expect(people.find((person) => person.id === dealer.id)?.campaign).toEqual({ id: campaignId, name: "Север — окна ПВХ", projectId });

    const other = await prisma.project.create({ data: { clientId, name: "Другой", position: 1 } });
    const narrowed = (await request(app).get(`/api/members?clientId=${clientId}&projectId=${other.id}`).set(admin.auth).expect(200)).body as Array<{ id: string }>;
    expect(narrowed.map((person) => person.id)).not.toContain(dealer.id);
  });

  it("are removed by the client's principal, who cannot remove people outside the client", async () => {
    const dealer = await join("dealer@north.by");
    const otherClient = await prisma.client.create({ data: { name: "Другой клиент", orgId: (await currentOrg()).id } });
    await request(app).delete(`/api/members/${dealer.id}`).set((await principal(otherClient.id)).auth).expect(404);
    await request(app).delete(`/api/members/${admin.membership!.id}`).set(boss.auth).expect(404);

    await request(app).delete(`/api/members/${dealer.id}`).set(boss.auth).expect(204);
    expect(await prisma.membership.count({ where: { role: "PARTNER" } })).toBe(0);
  });

  it("lose their membership and pending invitations when the campaign is deleted, while leads stay", async () => {
    const lead = await prisma.lead.create({ data: { orgId: (await currentOrg()).id, projectId, name: "Анна", stage: "NEW", position: 0 } });
    await join("dealer@north.by");
    const pending = codeOf((await invite(boss).expect(201)).body);

    await prisma.campaign.delete({ where: { id: campaignId } });

    expect(await prisma.membership.count({ where: { role: "PARTNER" } })).toBe(0);
    await request(app).get(`/api/registration/${pending}`).expect(404);
    expect(await prisma.lead.findUnique({ where: { id: lead.id } })).not.toBeNull();
  });
});
