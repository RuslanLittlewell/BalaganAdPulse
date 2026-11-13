import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { RandomIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { createLeadIntake } from "../../src/modules/leads/index.js";
import { PrismaLeadIntakeRepository } from "../../src/modules/leads/infrastructure/prisma-lead-intake-repository.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

const app = createApp();
const unitOfWork = new PrismaUnitOfWork(prisma);

let auth: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  auth = admin.auth;
  ({ projectId } = await seedProject(admin.user.id));
});

afterAll(() => prisma.$disconnect());

const leads = `/api/crm/boards`;
const addLead = async (name: string, stage?: string) =>
  (await request(app).post(`${leads}/${projectId}/leads`).set(auth).send({ name, ...(stage ? { stage } : {}) }).expect(201)).body as { id: string };
const move = (id: string, stage: string, position = 0) =>
  request(app).patch(`${leads}/${projectId}/leads/${id}/move`).set(auth).send({ stage, position }).expect(200);
const history = (leadId: string) =>
  prisma.leadStageChange.findMany({ where: { leadId }, orderBy: { changedAt: "asc" }, select: { fromStage: true, toStage: true, projectId: true, processedAt: true } });

describe("lead stage history", () => {
  it("records the first stage of a lead created by hand", async () => {
    const lead = await addLead("Анна");
    const column = (await request(app).post(`${leads}/${projectId}/columns`).set(auth).send({ name: "Замер" }).expect(201)).body as { id: string };
    const other = await addLead("Борис", column.id);

    expect(await history(lead.id)).toEqual([{ fromStage: null, toStage: "NEW", projectId, processedAt: null }]);
    expect(await history(other.id)).toEqual([{ fromStage: null, toStage: column.id, projectId, processedAt: null }]);
  });

  it("records a move to another stage and nothing for a reorder within a stage", async () => {
    const lead = await addLead("Анна");
    await addLead("Борис");
    await move(lead.id, "QUALIFIED");
    await move(lead.id, "QUALIFIED", 0);
    await move(lead.id, "NEW", 1);

    expect((await history(lead.id)).map(({ fromStage, toStage }) => [fromStage, toStage])).toEqual([
      [null, "NEW"],
      ["NEW", "QUALIFIED"],
      ["QUALIFIED", "NEW"],
    ]);
  });

  it("records the return to «Новый» of every lead in a deleted column", async () => {
    const column = (await request(app).post(`${leads}/${projectId}/columns`).set(auth).send({ name: "Замер" }).expect(201)).body as { id: string };
    const first = await addLead("Анна", column.id);
    const second = await addLead("Борис", column.id);
    await request(app).delete(`${leads}/${projectId}/columns/${column.id}`).set(auth).expect(204);

    for (const lead of [first, second]) {
      expect((await history(lead.id)).map(({ fromStage, toStage }) => [fromStage, toStage])).toEqual([
        [null, column.id],
        [column.id, "NEW"],
      ]);
    }
  });

  it("records the entry into «Новый» of an imported lead", async () => {
    const orgId = (await currentOrg()).id;
    const intake = createLeadIntake({ intake: new PrismaLeadIntakeRepository(unitOfWork), ids: new RandomIdGenerator(), unitOfWork, publish: vi.fn() });
    await unitOfWork.run((context) => intake.deliver(context, { orgId, projectId, leads: [{
      externalId: "1234567890123456", name: "Лид из формы", company: null, phone: "+375291234567", email: null,
      source: {
        accountId: "123", formId: "f1",
        campaign: { externalId: "c1", name: "Весна" }, adSet: { externalId: "s1", name: "Минск" }, ad: { externalId: "555", name: "Видео" },
        submittedAt: new Date("2026-09-10T10:00:00Z"), answers: [], answersOmitted: false,
      },
    }] }));
    const lead = await prisma.lead.findFirstOrThrow({ where: { name: "Лид из формы" } });

    expect(await history(lead.id)).toEqual([{ fromStage: null, toStage: "NEW", projectId, processedAt: null }]);
  });

  it("removes the history with the lead", async () => {
    const lead = await addLead("Анна");
    await move(lead.id, "TARGET");
    await request(app).delete(`${leads}/${projectId}/leads/${lead.id}`).set(auth).expect(204);

    expect(await history(lead.id)).toEqual([]);
  });
});
