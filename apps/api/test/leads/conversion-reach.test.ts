import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { PrismaConversionEventRepository } from "../../src/modules/leads/infrastructure/prisma-conversion-event-repository.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

const unitOfWork = new PrismaUnitOfWork(prisma);
const reach = new PrismaConversionEventRepository(prisma, unitOfWork);

let orgId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  orgId = (await currentOrg()).id;
  ({ projectId } = await seedProject(admin.user.id));
});

afterAll(() => prisma.$disconnect());

const at = (day: number, hour = 10) => new Date(Date.UTC(2026, 10, day, hour));
const lead = (name: string) => prisma.lead.create({ data: { orgId, projectId, name, stage: "NEW", position: 0 } });
const change = (leadId: string, from: string | null, to: string, changedAt: Date) =>
  prisma.leadStageChange.create({ data: { orgId, projectId, leadId, fromStage: from, toStage: to, changedAt } });
const event = (name: string, stages: string[], carriesAmount = false) =>
  prisma.crmConversionEvent.create({ data: { orgId, projectId, name, nameKey: name.toLowerCase(), stages, carriesAmount } });
const byChanges = (ids: string[]) => unitOfWork.run((context) => reach.reachedByChanges(context, ids));
const since = (from: Date) => unitOfWork.run((context) => reach.reachedSince(context, projectId, from));

describe("reaching a conversion event", () => {
  it("counts the first entry into the event's stages once, however often the lead returns", async () => {
    const qual = await event("Квал", ["QUALIFIED"]);
    const anna = await lead("Анна");
    await change(anna.id, null, "NEW", at(2));
    const monday = await change(anna.id, "NEW", "QUALIFIED", at(9));
    await change(anna.id, "QUALIFIED", "NEW", at(10));
    const wednesday = await change(anna.id, "NEW", "QUALIFIED", at(11));

    expect(await byChanges([monday.id])).toEqual([{
      orgId, projectId, leadId: anna.id, eventId: qual.id, eventName: "Квал", carriesAmount: false, reachedAt: at(9),
    }]);
    expect(await byChanges([wednesday.id])).toEqual([]);
    expect(await since(at(1))).toEqual([expect.objectContaining({ leadId: anna.id, eventId: qual.id, reachedAt: at(9) })]);
  });

  it("reaches every event a skipped-to stage belongs to", async () => {
    const qual = await event("Квал", ["QUALIFIED", "PROPOSAL"]);
    const sale = await event("Продажа", ["PROPOSAL"], true);
    const boris = await lead("Борис");
    await change(boris.id, null, "NEW", at(2));
    const jump = await change(boris.id, "NEW", "PROPOSAL", at(5));

    const reached = await byChanges([jump.id]);
    expect(reached.map((entry) => [entry.eventId, entry.carriesAmount, entry.reachedAt])).toEqual(
      expect.arrayContaining([[qual.id, false, at(5)], [sale.id, true, at(5)]]),
    );
    expect(reached).toHaveLength(2);
  });

  it("reads the event's stages as they are now, so a stage added later counts its past entries", async () => {
    const qual = await event("Квал", ["QUALIFIED"]);
    const vera = await lead("Вера");
    await change(vera.id, null, "NEW", at(2));
    await change(vera.id, "NEW", "TARGET", at(4));
    expect(await since(at(1))).toEqual([]);

    await prisma.crmConversionEvent.update({ where: { id: qual.id }, data: { stages: ["QUALIFIED", "TARGET"] } });

    expect(await since(at(1))).toEqual([expect.objectContaining({ leadId: vera.id, eventId: qual.id, reachedAt: at(4) })]);
    expect(await since(at(5))).toEqual([]);
  });

  it("ignores events of other projects and leads that never entered the stages", async () => {
    const other = await prisma.project.create({ data: { clientId: (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).clientId, name: "Второй", position: 1 } });
    await prisma.crmConversionEvent.create({ data: { orgId, projectId: other.id, name: "Квал", nameKey: "квал", stages: ["QUALIFIED"] } });
    await event("Продажа", ["PROPOSAL"]);
    const gleb = await lead("Глеб");
    const entry = await change(gleb.id, "NEW", "QUALIFIED", at(3));

    expect(await byChanges([entry.id])).toEqual([]);
    expect(await byChanges([])).toEqual([]);
  });
});
