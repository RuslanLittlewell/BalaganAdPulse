import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { RandomIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { createLeadIntake, type IncomingLead } from "../../src/modules/leads/index.js";
import { PrismaLeadIntakeRepository } from "../../src/modules/leads/infrastructure/prisma-lead-intake-repository.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

const unitOfWork = new PrismaUnitOfWork(prisma);
let orgId: string;
let clientId: string;
let projectId: string;
let publish: ReturnType<typeof vi.fn>;
let intake: ReturnType<typeof createLeadIntake>;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  orgId = (await currentOrg()).id;
  ({ clientId, projectId } = await seedProject(member.user.id));
  publish = vi.fn();
  intake = createLeadIntake({
    intake: new PrismaLeadIntakeRepository(prisma, unitOfWork),
    ids: new RandomIdGenerator(),
    unitOfWork,
    publish,
  });
});

afterAll(() => prisma.$disconnect());

const incoming =(externalId: string, overrides: Partial<IncomingLead> = {}): IncomingLead => ({
  externalId,
  name: `Лид ${externalId}`, company: null, phone: "+375291234567", email: null,
  source: {
    accountId: "123", formId: "f1",
    campaign: { externalId: "c1", name: "Весна" },
    adSet: { externalId: "s1", name: "Москва" },
    ad: { externalId: "555", name: "Видео 1" },
    submittedAt: new Date("2026-09-10T10:00:00Z"),
    answers: [{ question: "full_name", values: [`Лид ${externalId}`] }],
    answersOmitted: false,
  },
  ...overrides,
});

const deliver = (leads: IncomingLead[], target = { orgId, clientId, projectId }) =>
  unitOfWork.run((context) => intake.deliver(context, { ...target, leads }));

const boardLeads = (board: string | null) =>
  prisma.lead.findMany({ where: { orgId, clientId: board }, orderBy: [{ stage: "asc" }, { position: "asc" }] });

describe("lead intake", () => {
  it("places imported leads first in Новый лид on the project client's board, ahead of leads already there", async () => {
    await prisma.lead.create({ data: { name: "Вручную", orgId, clientId, position: 0 } });

    const result = await deliver([incoming("L1"), incoming("L2")]);

    expect(result).toEqual({ created: 2 });
    const rows = await boardLeads(clientId);
    expect(rows.map((row) => [row.name, row.stage, row.position])).toEqual([
      ["Лид L1", "NEW", 0], ["Лид L2", "NEW", 1], ["Вручную", "NEW", 2],
    ]);
    const imported = await prisma.lead.findFirstOrThrow({ where: { name: "Лид L1" }, include: { metaSource: true, metaKey: true } });
    expect(imported).toMatchObject({ origin: "META", projectId, clientId, phone: "+375291234567" });
    expect(imported.metaSource).toMatchObject({ formId: "f1", campaignName: "Весна", adSetName: "Москва", adName: "Видео 1", adExternalId: "555" });
    expect(imported.metaKey).toMatchObject({ orgId, externalId: "L1" });
  });

  it("never places a lead on the agency board or another client's board", async () => {
    const other = await seedProject("unused", "Другой клиент");

    await deliver([incoming("L1")]);

    expect(await boardLeads(null)).toEqual([]);
    expect(await boardLeads(other.clientId)).toEqual([]);
    expect(await boardLeads(clientId)).toHaveLength(1);
  });

  it("skips a Meta lead already imported, in a later poll or twice in one", async () => {
    await deliver([incoming("L1"), incoming("L1")]);
    const again = await deliver([incoming("L1", { name: "Изменено" })]);

    expect(again).toEqual({ created: 0 });
    expect((await boardLeads(clientId)).map((row) => row.name)).toEqual(["Лид L1"]);
  });

  it("does not bring back an imported lead a member deleted", async () => {
    await deliver([incoming("L1")]);
    await prisma.lead.deleteMany({ where: { orgId } });

    expect(await deliver([incoming("L1")])).toEqual({ created: 0 });
    expect(await boardLeads(clientId)).toEqual([]);
  });

  it("keeps one lead and contiguous positions under concurrent intake", async () => {
    await Promise.all([
      deliver([incoming("L1"), incoming("L2")]),
      deliver([incoming("L2"), incoming("L3")]),
    ]);

    const rows = await boardLeads(clientId);
    expect(rows.map((row) => row.name).sort()).toEqual(["Лид L1", "Лид L2", "Лид L3"]);
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(await prisma.metaLead.count()).toBe(3);
  });

  it("attributes imported leads to no member in the audit trail", async () => {
    await deliver([incoming("L1")]);

    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("announces a board only when asked after the commit, and a rolled back intake leaves nothing", async () => {
    await expect(unitOfWork.run(async (context) => {
      await intake.deliver(context, { orgId, clientId, projectId, leads: [incoming("L1")] });
      expect(publish).not.toHaveBeenCalled();
      throw new Error("lost the lease");
    })).rejects.toThrow("lost the lease");

    expect(await boardLeads(clientId)).toEqual([]);
    expect(await prisma.metaLead.count()).toBe(0);
    expect(publish).not.toHaveBeenCalled();

    await deliver([incoming("L1")]);
    intake.announce({ orgId, clientId });
    expect(publish).toHaveBeenCalledExactlyOnceWith({ kind: "crm.changed", orgId, board: clientId });
  });
});

describe("attribution of imported leads", () => {
  async function seedHierarchy(target = projectId) {
    const campaign = await prisma.campaign.create({ data: { projectId: target, name: "Весна", channel: "META", externalId: target === projectId ? "c1" : `c-${target}`, position: 0 } });
    const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Москва", externalId: "s1", position: 0 } });
    const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: "Видео 1", externalId: "555", position: 0 } });
    return { campaign, ad };
  }

  it("links the campaign and ad already imported into the project", async () => {
    const { campaign, ad } = await seedHierarchy();

    await deliver([incoming("L1")]);

    expect(await prisma.lead.findFirstOrThrow({ where: { orgId } })).toMatchObject({ campaignId: campaign.id, adId: ad.id });
  });

  it("does not link an ad with the same Meta identifier in another project", async () => {
    const other = await seedProject("unused", "Другой");
    await seedHierarchy(other.projectId);

    await deliver([incoming("L1")]);

    expect(await prisma.lead.findFirstOrThrow({ where: { orgId } })).toMatchObject({ campaignId: null, adId: null });
  });

  it("links leads once a later advertising import brings their campaign and ad, and announces the board", async () => {
    await deliver([incoming("L1")]);
    expect(await prisma.lead.findFirstOrThrow({ where: { orgId } })).toMatchObject({ campaignId: null, adId: null });
    const { campaign, ad } = await seedHierarchy();

    await intake.link(projectId);

    expect(await prisma.lead.findFirstOrThrow({ where: { orgId } })).toMatchObject({ campaignId: campaign.id, adId: ad.id });
    expect(publish).toHaveBeenCalledExactlyOnceWith({ kind: "crm.changed", orgId, board: clientId });
  });

  it("releases links when the campaign and ad are removed locally, keeping the Meta names", async () => {
    const { campaign } = await seedHierarchy();
    await deliver([incoming("L1")]);

    await prisma.campaign.delete({ where: { id: campaign.id } });
    await intake.link(projectId);

    const lead = await prisma.lead.findFirstOrThrow({ where: { orgId }, include: { metaSource: true } });
    expect(lead).toMatchObject({ campaignId: null, adId: null, projectId });
    expect(lead.metaSource).toMatchObject({ campaignName: "Весна", adSetName: "Москва", adName: "Видео 1" });
    expect(publish).not.toHaveBeenCalled();
  });

  it("leaves hand-made leads of the project alone", async () => {
    await prisma.lead.create({ data: { name: "Вручную", orgId, clientId, projectId } });
    await seedHierarchy();

    await intake.link(projectId);

    expect(await prisma.lead.findFirstOrThrow({ where: { name: "Вручную" } })).toMatchObject({ campaignId: null, adId: null });
  });
});
