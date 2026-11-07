import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { PrismaSiteRepository } from "../../src/modules/seo/infrastructure/prisma-site-repository.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-4000-8000-000000000000";
let auth: { Authorization: string };
let projectId: string;
let clientId: string;
let siteId: string;
const base = () => `/api/projects/${projectId}/seo`;

const addSite = (forProject: string, siteUrl = "sc-domain:site.ru") =>
  prisma.seoSite.create({ data: {
    projectId: forProject, siteUrl, encryptedToken: "sealed-credential", revision: "v1", status: "SUCCESS",
    nextDailyAt: new Date(), nextCheckAt: new Date(), checkStatus: "SUCCESS",
  } });

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  ({ auth } = member);
  ({ projectId, clientId } = await seedProject(member.user.id));
  siteId = (await addSite(projectId)).id;
});
afterAll(() => prisma.$disconnect());

describe("connected sites over HTTP", () => {
  it("are listed with their label and state and never with the credential", async () => {
    const res = await request(app).get(`${base()}/sites`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: siteId, siteUrl: "sc-domain:site.ru", label: "site.ru", status: "SUCCESS", checkStatus: "SUCCESS" })]);
    expect(JSON.stringify(res.body)).not.toContain("sealed-credential");
  });

  it("are listed to a client's person who reaches the project, who may not manage them", async () => {
    const person = await signInAs("Client", { role: "CLIENT" });
    await grantAccess(person.membership!.id, clientId);

    expect((await request(app).get(`${base()}/sites`).set(person.auth)).status).toBe(200);
    expect((await request(app).post(`${base()}/sites/${siteId}/sync`).set(person.auth)).status).toBe(403);
    expect((await request(app).post(`${base()}/sites/${siteId}/audit`).set(person.auth)).status).toBe(403);
    expect((await request(app).delete(`${base()}/sites/${siteId}`).set(person.auth)).status).toBe(403);
  });

  it("are refused to a guest's changes", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    expect((await request(app).post(`${base()}/sites/${siteId}/sync`).set(guest.auth)).status).toBe(403);
    expect((await request(app).post(`${base()}/authorize`).set(guest.auth).send({})).status).toBe(403);
  });

  it("need a session", async () => {
    expect((await request(app).get(`${base()}/sites`)).status).toBe(401);
    expect((await request(app).post(`${base()}/authorize`).send({})).status).toBe(401);
    expect((await request(app).post(`${base()}/sites`).send({ authorization: MISSING })).status).toBe(401);
  });

  it("answer 404 for a project or a site out of reach", async () => {
    const other = await seedProject("x", "Other");
    const foreign = await addSite(other.projectId);
    expect((await request(app).get(`/api/projects/${MISSING}/seo/sites`).set(auth)).status).toBe(404);
    expect((await request(app).post(`${base()}/sites/${foreign.id}/sync`).set(auth)).status).toBe(404);
    expect((await request(app).delete(`${base()}/sites/${MISSING}`).set(auth)).status).toBe(404);
  });

  it("report that Google is not configured when the server has no Google client", async () => {
    const res = await request(app).post(`${base()}/authorize`).set(auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ code: "CONFIGURATION" }]);
  });

  it("refuse a connection that names no sign-in", async () => {
    expect((await request(app).post(`${base()}/sites`).set(auth).send({ siteUrl: "sc-domain:site.ru" })).status).toBe(400);
  });

  it("queue an import and a page check when asked", async () => {
    await prisma.seoSite.update({ where: { id: siteId }, data: { status: "SUCCESS", checkStatus: "SUCCESS" } });

    const synced = await request(app).post(`${base()}/sites/${siteId}/sync`).set(auth);
    const checked = await request(app).post(`${base()}/sites/${siteId}/audit`).set(auth);

    expect(synced.status).toBe(202);
    expect(synced.body).toMatchObject({ id: siteId, status: "QUEUED" });
    expect(checked.status).toBe(202);
    expect(checked.body).toMatchObject({ id: siteId, checkStatus: "QUEUED" });
  });

  it("keep a site waiting for a new sign-in when refreshed", async () => {
    await prisma.seoSite.update({ where: { id: siteId }, data: { status: "AUTH_REQUIRED", lastError: "TOKEN" } });

    const res = await request(app).post(`${base()}/sites/${siteId}/sync`).set(auth);

    expect(res.body).toMatchObject({ status: "AUTH_REQUIRED", lastError: "TOKEN" });
    expect((await prisma.seoSite.findUniqueOrThrow({ where: { id: siteId } })).queuedAt).not.toBeNull();
  });

  it("can be disconnected, taking the site's SEO data with it", async () => {
    await prisma.seoDay.create({ data: { siteId, date: new Date("2026-11-01"), clicks: 1, impressions: 10, position: 3 } });

    const res = await request(app).delete(`${base()}/sites/${siteId}`).set(auth);

    expect(res.status).toBe(204);
    expect(await prisma.seoSite.count()).toBe(0);
    expect(await prisma.seoDay.count()).toBe(0);
    expect(JSON.stringify(await prisma.auditEvent.findMany())).toContain("Disconnected Search Console site site.ru");
  });
});

describe("the site store", () => {
  const unitOfWork = new PrismaUnitOfWork<Parameters<Parameters<typeof prisma.$transaction>[0]>[0]>(prisma);
  const sites = () => new PrismaSiteRepository(prisma, unitOfWork);

  it("adds a site with an import and a check queued, leaving the project's currency alone", async () => {
    await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: "USD" } });
    const now = new Date();

    const added = await unitOfWork.run((context) =>
      sites().add(context, { projectId, siteUrl: "https://shop.ru/", encryptedToken: "sealed" }, now));

    expect(added).toMatchObject({ status: "QUEUED", checkStatus: "QUEUED", queuedAt: now, checkQueuedAt: now });
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).budgetCurrency).toBe("USD");
  });

  it("refuses the same site twice as a conflict", async () => {
    await expect(unitOfWork.run((context) =>
      sites().add(context, { projectId, siteUrl: "sc-domain:site.ru", encryptedToken: "sealed" }, new Date())))
      .rejects.toMatchObject({ category: "conflict" });
  });

  it("renews a site with a new revision so earlier work cannot commit", async () => {
    const renewed = await unitOfWork.run((context) => sites().renew(context, siteId, "fresh", new Date()));
    expect(renewed).toMatchObject({ encryptedToken: "fresh", status: "QUEUED", lastError: null });
    expect(renewed.revision).not.toBe("v1");
  });
});
