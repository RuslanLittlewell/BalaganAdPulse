import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

type Auth = { Authorization: string };

let admin: Auth;
let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs("Admin", { role: "ADMIN" });
  admin = signedIn.auth;
  ({ clientId, projectId } = await seedProject(signedIn.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

const projectTiles = (id = projectId) => `/api/projects/${id}/summary-tiles`;
const dashboardTiles = "/api/dashboard/summary-tiles";

const choose = (path: string, tiles: unknown, auth: Auth = admin) =>
  request(app).put(path).set(auth).send({ tiles });

const tilesAt = async (path: string, auth: Auth = admin) =>
  (await request(app).get(path).set(auth)).body.tiles;

describe("a project's summary tiles", () => {
  it("start with none on a project created now", async () => {
    const created = await request(app).post("/api/projects").set(admin).send({ clientId, name: "Новый" });

    expect(await tilesAt(projectTiles(created.body.id))).toEqual([]);
  });

  it("are chosen by a manager and read the same by everyone who reaches the project, in catalogue order", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const guest = await signInAs("Guest", { role: "GUEST" });
    const customer = await signInAs("Customer", { role: "CLIENT" });
    for (const member of [manager, guest, customer]) await grantAccess(member.membership!.id, clientId);

    const res = await choose(projectTiles(), ["KPI", "CLICKS", "SPEND"], manager.auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tiles: ["SPEND", "CLICKS", "KPI"] });
    for (const auth of [admin, manager.auth, guest.auth, customer.auth]) {
      expect(await tilesAt(projectTiles(), auth)).toEqual(["SPEND", "CLICKS", "KPI"]);
    }
  });

  it("belong to one project, leaving the others as they were", async () => {
    const other = await request(app).post("/api/projects").set(admin).send({ clientId, name: "Другой" });

    await choose(projectTiles(), ["CLICKS"]);

    expect(await tilesAt(projectTiles(other.body.id))).toEqual([]);
  });

  it("offer results between leads and CPC", async () => {
    expect((await choose(projectTiles(), ["CPC", "RESULTS", "CONVERSIONS"])).body)
      .toEqual({ tiles: ["CONVERSIONS", "RESULTS", "CPC"] });
  });

  it("may be cleared", async () => {
    expect((await choose(projectTiles(), [])).body).toEqual({ tiles: [] });
  });

  it("are recorded in the audit trail", async () => {
    await choose(projectTiles(), ["SPEND", "CONVERSIONS"]);

    const events = await prisma.auditEvent.findMany({ where: { entityType: "project", entityId: projectId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "UPDATE", clientId, projectId,
      changes: { before: [], after: ["SPEND", "CONVERSIONS"] },
    });
  });

  it.each(["GUEST", "CLIENT", "CLIENT_ADMIN"] as const)("are refused to a %s -> 403", async (role) => {
    const member = await signInAs(role, { role });
    await grantAccess(member.membership!.id, clientId);

    expect((await choose(projectTiles(), ["SPEND"], member.auth)).status).toBe(403);
    expect(await tilesAt(projectTiles())).toEqual([]);
  });

  it("answer 404 for a project out of reach, to read or to change", async () => {
    const outsider = await signInAsOutsider();

    expect((await request(app).get(projectTiles()).set(outsider.auth)).status).toBe(404);
    expect((await choose(projectTiles(), ["SPEND"], outsider.auth)).status).toBe(404);
  });

  it.each([
    ["six tiles", ["SPEND", "IMPRESSIONS", "CLICKS", "CONVERSIONS", "CPC", "KPI"]],
    ["a repeated tile", ["SPEND", "SPEND"]],
    ["a tile outside the catalogue", ["REACH"]],
    ["no list at all", "SPEND"],
  ])("refuse %s -> 400", async (_, tiles) => {
    expect((await choose(projectTiles(), tiles)).status).toBe(400);
    expect(await tilesAt(projectTiles())).toEqual([]);
  });
});

describe("a member's dashboard tiles", () => {
  it("start with leads alone", async () => {
    expect(await tilesAt(dashboardTiles)).toEqual(["CONVERSIONS"]);
  });

  it("belong to the member who chose them, whatever their role", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    const customer = await signInAs("Customer", { role: "CLIENT" });

    expect((await choose(dashboardTiles, ["CPC", "SPEND"], guest.auth)).body).toEqual({ tiles: ["SPEND", "CPC"] });
    expect((await choose(dashboardTiles, ["CLICKS"], customer.auth)).status).toBe(200);

    expect(await tilesAt(dashboardTiles, guest.auth)).toEqual(["SPEND", "CPC"]);
    expect(await tilesAt(dashboardTiles, customer.auth)).toEqual(["CLICKS"]);
    expect(await tilesAt(dashboardTiles)).toEqual(["CONVERSIONS"]);
  });

  it("leave every project's tiles alone", async () => {
    await choose(dashboardTiles, ["SPEND"]);

    expect(await tilesAt(projectTiles())).toEqual([]);
  });

  it("are not audited", async () => {
    await choose(dashboardTiles, ["SPEND"]);

    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("refuse more than five tiles -> 400", async () => {
    expect((await choose(dashboardTiles, ["SPEND", "IMPRESSIONS", "CLICKS", "CONVERSIONS", "CPC", "KPI"])).status).toBe(400);
  });

  it("need a signed-in member -> 401", async () => {
    expect((await request(app).get(dashboardTiles)).status).toBe(401);
  });
});
