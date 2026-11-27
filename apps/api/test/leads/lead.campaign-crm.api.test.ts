import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { RandomIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { createLeadUseCases } from "../../src/modules/leads/index.js";
import { PrismaLeadRepository } from "../../src/modules/leads/infrastructure/prisma-lead-repository.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let clientId: string;
let projectId: string;
let otherProjectId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs();
  ({ clientId, projectId } = await seedProject(admin.user.id));
  otherProjectId = (await prisma.project.create({ data: { clientId, name: "Второй", position: 1 } })).id;
});

afterAll(() => prisma.$disconnect());

const boards = async (as = admin.auth) =>
  (await request(app).get("/api/crm/boards").set(as).expect(200)).body as Array<{ key: string; campaignCrm: boolean }>;
const switchTo = (campaignCrm: unknown, board = projectId, as = admin.auth) =>
  request(app).patch(`/api/crm/boards/${board}`).set(as).send({ campaignCrm });
const settingOf = async (board: string) => (await boards()).find((entry) => entry.key === board)?.campaignCrm;

describe("CRM by campaign of a project", () => {
  it("is off for a new project", async () => {
    expect(await settingOf(projectId)).toBe(false);
  });

  it("is turned on and off for one project and returns the board", async () => {
    const on = await switchTo(true);

    expect(on.status).toBe(200);
    expect(on.body).toMatchObject({ key: projectId, campaignCrm: true, capabilities: { update: true } });
    expect(await settingOf(projectId)).toBe(true);
    expect(await settingOf(otherProjectId)).toBe(false);

    await switchTo(false).expect(200);
    expect(await settingOf(projectId)).toBe(false);
  });

  it("is the same for every member of the project", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);

    await switchTo(true).expect(200);

    expect((await boards(manager.auth)).find((entry) => entry.key === projectId)?.campaignCrm).toBe(true);
  });

  it("is refused to a guest and leaves the setting as it was", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);

    expect((await switchTo(true, projectId, guest.auth)).status).toBe(403);
    expect(await settingOf(projectId)).toBe(false);
  });

  it("answers 404 for a board the member does not reach and 400 for a body that is not a switch", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId, projectId);

    expect((await switchTo(true, otherProjectId, manager.auth)).status).toBe(404);
    expect((await switchTo("yes")).status).toBe(400);
    expect((await request(app).patch(`/api/crm/boards/${projectId}`).set(admin.auth).send({ campaignCrm: true, name: "Новое" })).status).toBe(400);
    expect(await settingOf(otherProjectId)).toBe(false);
  });

  it("records a change with its project, and nothing when the setting stays", async () => {
    await switchTo(true).expect(200);
    await switchTo(true).expect(200);

    const events = await prisma.auditEvent.findMany({ where: { entityType: "project", entityId: projectId } });
    expect(events).toHaveLength(1);
    expect([events[0].action, events[0].clientId, events[0].projectId]).toEqual(["UPDATE", clientId, projectId]);
    expect(events[0].changes).toEqual({ campaignCrm: { before: false, after: true } });
  });

  it("tells open boards to reload the boards list", async () => {
    const unitOfWork = new PrismaUnitOfWork(prisma);
    const publish = vi.fn();
    const useCases = createLeadUseCases({
      leads: new PrismaLeadRepository(prisma, unitOfWork),
      fields: { list: vi.fn().mockResolvedValue([]) },
      storage: { remove: vi.fn() },
      audit: { append: vi.fn() },
      ids: new RandomIdGenerator(),
      unitOfWork,
      publish,
    });

    await useCases.setCampaignCrm(admin.actor!, projectId, true);

    expect(publish).toHaveBeenCalledWith({ kind: "crm.changed", orgId: admin.actor!.orgId, board: projectId, resources: ["boards"] });
  });
});
