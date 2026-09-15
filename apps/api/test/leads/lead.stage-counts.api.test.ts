import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

let auth: { Authorization: string };
let orgId: string;
let clientId: string;
let projectId: string;
let otherProjectId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  orgId = (await currentOrg()).id;
  ({ clientId, projectId } = await seedProject(admin.user.id, "Ромашка"));
  otherProjectId = (await prisma.project.create({ data: { clientId, name: "Василёк", position: 1 } })).id;
});

afterAll(() => prisma.$disconnect());

const SEPTEMBER = "from=2026-09-01&to=2026-09-30";
const counts = (query = SEPTEMBER, as = auth) => request(app).get(`/api/crm/project-stage-counts?${query}`).set(as);

type Seed = {
  stage?: "NEW" | "QUALIFIED" | "TARGET" | "PROPOSAL" | null;
  project?: string | null;
  board?: string | null;
  createdAt?: string;
  submittedAt?: string;
  columnId?: string;
};

let seeded = 0;
function seedLead({ stage = "NEW", project = projectId, board = clientId, createdAt = "2026-09-10T12:00:00Z", submittedAt, columnId }: Seed = {}) {
  seeded += 1;
  return prisma.lead.create({
    data: {
      name: `Лид ${seeded}`, orgId, clientId: board, projectId: project, stage, columnId, createdAt: new Date(createdAt),
      ...(submittedAt ? {
        origin: "META" as const,
        metaSource: {
          create: {
            accountId: "123", formId: "f1", campaignExternalId: "c1", campaignName: "Весна",
            adSetExternalId: "s1", adSetName: "Москва", adExternalId: "555", adName: "Видео 1",
            submittedAt: new Date(submittedAt), answers: [],
          },
        },
      } : {}),
    },
  });
}

const byProject = (body: Array<{ projectId: string }>) =>
  Object.fromEntries(body.map(({ projectId: id, ...rest }) => [id, rest]));

describe("period lead counts per project and fixed stage", () => {
  it("counts the leads that arrived in the range by the stage they are in now", async () => {
    const moved = await seedLead({ createdAt: "2026-09-05T08:00:00Z" });
    await seedLead({ createdAt: "2026-09-06T08:00:00Z" });
    await seedLead({ stage: "TARGET", project: otherProjectId, board: null });
    await request(app).patch(`/api/crm/boards/${clientId}/leads/${moved.id}/move`).set(auth).send({ stage: "PROPOSAL", position: 0 }).expect(200);

    const response = await counts();

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(byProject(response.body)).toEqual({
      [projectId]: { NEW: 1, QUALIFIED: 0, TARGET: 0, PROPOSAL: 1 },
      [otherProjectId]: { NEW: 0, QUALIFIED: 0, TARGET: 1, PROPOSAL: 0 },
    });
  });

  it("includes both ends of the range as whole UTC days and nothing beyond them", async () => {
    await seedLead({ createdAt: "2026-08-31T23:59:59Z" });
    await seedLead({ createdAt: "2026-09-01T00:00:00Z" });
    await seedLead({ createdAt: "2026-09-30T23:59:59Z" });
    await seedLead({ createdAt: "2026-10-01T00:00:00Z" });

    expect(byProject((await counts()).body)).toEqual({ [projectId]: { NEW: 2, QUALIFIED: 0, TARGET: 0, PROPOSAL: 0 } });
  });

  it("counts a Meta lead by when its form was submitted, not when it was imported", async () => {
    await seedLead({ stage: "QUALIFIED", createdAt: "2026-10-01T08:00:00Z", submittedAt: "2026-09-30T22:00:00Z" });
    await seedLead({ stage: "QUALIFIED", createdAt: "2026-09-02T08:00:00Z", submittedAt: "2026-08-31T22:00:00Z" });

    expect(byProject((await counts()).body)).toEqual({ [projectId]: { NEW: 0, QUALIFIED: 1, TARGET: 0, PROPOSAL: 0 } });
  });

  it("leaves out leads in custom columns and leads without a project", async () => {
    const column = await prisma.leadColumn.create({ data: { orgId, clientId, name: "Встреча", position: 0 } });
    await seedLead({ stage: null, columnId: column.id });
    await seedLead({ project: null });

    expect((await counts()).body).toEqual([]);
  });

  it("counts only leads on boards the member reaches", async () => {
    await seedLead({ stage: "NEW" });
    await seedLead({ stage: "TARGET", board: null });
    const customer = await signInAs("Customer", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId, projectId);

    expect(byProject((await counts(SEPTEMBER, customer.auth)).body)).toEqual({ [projectId]: { NEW: 1, QUALIFIED: 0, TARGET: 0, PROPOSAL: 0 } });
    expect(byProject((await counts(SEPTEMBER, manager.auth)).body)).toEqual({ [projectId]: { NEW: 0, QUALIFIED: 0, TARGET: 1, PROPOSAL: 0 } });
  });

  it("keeps other organizations apart", async () => {
    await seedLead();
    const outsider = await signInAsOutsider();

    expect((await counts(SEPTEMBER, outsider.auth)).body).toEqual([]);
  });

  it("carries project ids and counts only", async () => {
    await seedLead();

    const [row] = (await counts()).body;

    expect(Object.keys(row).sort()).toEqual(["NEW", "PROPOSAL", "QUALIFIED", "TARGET", "projectId"]);
  });

  it.each([
    ["a missing end", "from=2026-09-01"],
    ["a malformed day", "from=2026-9-01&to=2026-09-30"],
    ["a reversed range", "from=2026-09-30&to=2026-09-01"],
  ])("refuses %s", async (_, query) => {
    expect((await counts(query)).status).toBe(400);
  });

  it("requires a signed-in member", async () => {
    expect((await request(app).get(`/api/crm/project-stage-counts?${SEPTEMBER}`)).status).toBe(401);
  });

  it("is documented", async () => {
    const doc = (await request(app).get("/api/openapi.json")).body;

    expect(doc.paths["/api/crm/project-stage-counts"]).toHaveProperty("get");
  });
});
