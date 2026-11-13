import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { AesCredentialCipher } from "../../src/modules/integrations/infrastructure/credential-cipher.js";
import { PrismaConversionEventRepository } from "../../src/modules/leads/infrastructure/prisma-conversion-event-repository.js";
import { createConversionWorker } from "../../src/modules/conversions/index.js";
import { PrismaConversionJobs } from "../../src/modules/conversions/infrastructure/prisma-conversion-jobs.js";
import { PrismaDatasetRepository } from "../../src/modules/conversions/infrastructure/prisma-dataset-repository.js";
import { ConversionsApiError, type OutgoingEvent } from "../../src/modules/conversions/domain/conversions.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const unitOfWork = new PrismaUnitOfWork(prisma);
const cipher = new AesCredentialCipher(Buffer.alloc(32, 7).toString("base64"));
const reach = new PrismaConversionEventRepository(prisma, unitOfWork);

let orgId: string;
let projectId: string;
let clock: { current: Date; now(): Date };
let sent: OutgoingEvent[][];
let send: ReturnType<typeof vi.fn>;

const worker = () => createConversionWorker({
  jobs: new PrismaConversionJobs(prisma, unitOfWork),
  reach,
  api: { dataset: vi.fn(), send },
  cipher,
  unitOfWork,
  clock,
});

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs();
  orgId = (await currentOrg()).id;
  ({ projectId } = await seedProject(admin.user.id));
  await prisma.metaDataset.create({ data: {
    projectId, orgId, datasetId: "1234567890", datasetName: "Пиксель", encryptedToken: cipher.encrypt("capi-token", projectId),
    currency: "BYN", revision: "r1",
  } });
  clock = { current: new Date(), now() { return this.current; } };
  sent = [];
  send = vi.fn(async (_dataset: string, _token: string, events: OutgoingEvent[]) => { sent.push(events); });
});

afterAll(() => prisma.$disconnect());

const event = (name: string, stages: string[], carriesAmount = false) =>
  prisma.crmConversionEvent.create({ data: { orgId, projectId, name, nameKey: name.toLowerCase(), stages, carriesAmount } });
const formLead = async (name: string, externalId: string, data: { amount?: string; phone?: string; email?: string } = {}) => {
  const clientId = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).clientId;
  const person = await prisma.person.create({ data: { orgId, clientId, name, phone: data.phone ?? null, email: data.email ?? null } });
  const lead = await prisma.lead.create({ data: { orgId, projectId, name, origin: "META", stage: "NEW", position: 0, personId: person.id, amount: data.amount ?? null } });
  await prisma.metaLead.create({ data: { orgId, externalId, leadId: lead.id } });
  return lead;
};
const enters = (leadId: string, toStage: string, changedAt = clock.current) =>
  prisma.leadStageChange.create({ data: { orgId, projectId, leadId, toStage, changedAt } });
const sends = () => prisma.metaConversionSend.findMany({ orderBy: { reachedAt: "asc" } });
const later = (ms: number) => { clock.current = new Date(clock.current.getTime() + ms); };

describe("the conversion worker", () => {
  it("sends an event a form lead reaches once, with its identifiers, and marks the stage change processed", async () => {
    const qual = await event("Квал", ["QUALIFIED"]);
    const anna = await formLead("Анна", "12345678901234567", { phone: "+375 (29) 123-45-67", email: " Anna@Mail.ru " });
    const reachedAt = new Date(clock.current.getTime() - HOUR);
    const change = await enters(anna.id, "QUALIFIED", reachedAt);

    await worker().runOnce();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]!.slice(0, 2)).toEqual(["1234567890", "capi-token"]);
    expect(sent[0]).toEqual([{
      id: expect.any(String), eventName: "Квал", eventTime: reachedAt, metaLeadId: "12345678901234567", leadId: anna.id,
      phone: "375291234567", email: "anna@mail.ru", value: null, currency: null,
    }]);
    expect(await sends()).toEqual([expect.objectContaining({ eventId: qual.id, status: "SENT", sentAt: clock.current, test: false })]);
    expect((await prisma.leadStageChange.findUniqueOrThrow({ where: { id: change.id } })).processedAt).toEqual(clock.current);
    expect((await prisma.metaDataset.findUniqueOrThrow({ where: { projectId } })).lastSentAt).toEqual(clock.current);

    await enters(anna.id, "NEW");
    await enters(anna.id, "QUALIFIED", new Date(clock.current.getTime() + 1000));
    later(2 * 60_000);
    await worker().runOnce();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends nothing for a lead entered by hand", async () => {
    await event("Квал", ["QUALIFIED"]);
    const manual = await prisma.lead.create({ data: { orgId, projectId, name: "Вручную", stage: "NEW", position: 0 } });
    await enters(manual.id, "QUALIFIED");

    await worker().runOnce();

    expect(send).not.toHaveBeenCalled();
    expect(await sends()).toEqual([]);
    expect(await prisma.leadStageChange.count({ where: { processedAt: null } })).toBe(0);
  });

  it("marks the sends of a test event code as test sends", async () => {
    await prisma.metaDataset.update({ where: { projectId }, data: { testEventCode: "TEST123" } });
    await event("Квал", ["QUALIFIED"]);
    await enters((await formLead("Анна", "1")).id, "QUALIFIED");

    await worker().runOnce();

    expect(send.mock.calls[0]![3]).toBe("TEST123");
    expect((await sends())[0]).toMatchObject({ status: "SENT", test: true });
  });

  it("holds a sale until its amount is entered and then sends the amount with the stage change's time", async () => {
    await event("Продажа", ["PROPOSAL"], true);
    const lead = await formLead("Борис", "2");
    const reachedAt = clock.current;
    await enters(lead.id, "PROPOSAL", reachedAt);

    await worker().runOnce();
    expect(send).not.toHaveBeenCalled();
    expect((await sends())[0]).toMatchObject({ status: "WAITING_AMOUNT", holdUntil: new Date(reachedAt.getTime() + 72 * HOUR) });

    await prisma.lead.update({ where: { id: lead.id }, data: { amount: "900" } });
    later(6 * HOUR);
    await worker().runOnce();

    expect(sent.flat()).toEqual([expect.objectContaining({ eventName: "Продажа", eventTime: reachedAt, value: 900, currency: "BYN" })]);
    expect((await sends())[0]).toMatchObject({ status: "SENT", currency: "BYN" });
    expect((await sends())[0]!.value?.toString()).toBe("900");
  });

  it("sends a sale without a value once three days pass with no amount", async () => {
    await event("Продажа", ["PROPOSAL"], true);
    await enters((await formLead("Вера", "3")).id, "PROPOSAL");
    await worker().runOnce();

    later(71 * HOUR);
    await worker().runOnce();
    expect(send).not.toHaveBeenCalled();

    later(2 * HOUR);
    await worker().runOnce();
    expect(sent.flat()).toEqual([expect.objectContaining({ eventName: "Продажа", value: null, currency: null })]);
  });

  it("waits for a new token after Meta rejects one and resumes once it is replaced", async () => {
    await event("Квал", ["QUALIFIED"]);
    await enters((await formLead("Глеб", "4")).id, "QUALIFIED");
    send.mockRejectedValueOnce(new ConversionsApiError("AUTH", "Error validating access token"));

    await worker().runOnce();
    expect(await prisma.metaDataset.findUniqueOrThrow({ where: { projectId } })).toMatchObject({ state: "AUTH_REQUIRED", lastError: "Error validating access token" });
    expect((await sends())[0]).toMatchObject({ status: "PENDING" });

    later(10 * 60_000);
    await worker().runOnce();
    expect(send).toHaveBeenCalledTimes(1);

    await unitOfWork.run((context) => new PrismaDatasetRepository(prisma, unitOfWork).save(context, {
      projectId, orgId, datasetId: "1234567890", datasetName: "Пиксель", encryptedToken: cipher.encrypt("new-token", projectId),
      testEventCode: null, currency: "BYN", revision: "r2", tokenChanged: true,
    }));
    await worker().runOnce();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![1]).toBe("new-token");
    expect((await sends())[0]).toMatchObject({ status: "SENT" });
  });

  it("expires an event whose stage change is more than seven days old instead of sending it", async () => {
    await event("Квал", ["QUALIFIED"]);
    await enters((await formLead("Дина", "5")).id, "QUALIFIED");
    await prisma.metaDataset.update({ where: { projectId }, data: { state: "AUTH_REQUIRED" } });
    await worker().runOnce();

    later(8 * DAY);
    await prisma.metaDataset.update({ where: { projectId }, data: { state: "ACTIVE" } });
    await worker().runOnce();

    expect(send).not.toHaveBeenCalled();
    expect((await sends())[0]).toMatchObject({ status: "EXPIRED", lastError: "Older than the seven days Meta accepts" });
  });

  it("retries a temporary failure after a pause", async () => {
    await event("Квал", ["QUALIFIED"]);
    await enters((await formLead("Ева", "6")).id, "QUALIFIED");
    send.mockRejectedValueOnce(new ConversionsApiError("TEMPORARY", "", "http 503"));

    await worker().runOnce();
    expect((await sends())[0]).toMatchObject({ status: "PENDING", attempts: 1, nextAttemptAt: new Date(clock.current.getTime() + 60_000), lastError: "http 503" });

    later(30_000);
    await worker().runOnce();
    expect(send).toHaveBeenCalledTimes(1);

    later(60_000);
    await worker().runOnce();
    expect(send).toHaveBeenCalledTimes(2);
    expect((await sends())[0]).toMatchObject({ status: "SENT", lastError: null });
  });

  it("sends the rest of a batch when Meta refuses one event and keeps Meta's reason for it", async () => {
    await event("Квал", ["QUALIFIED"]);
    const leads = await Promise.all(["Жанна", "Зоя", "Ира"].map((name, index) => formLead(name, `7${index}`)));
    for (const [index, lead] of leads.entries()) await enters(lead.id, "QUALIFIED", new Date(clock.current.getTime() - (3 - index) * 60_000));
    const refusedLead = leads[1]!.id;
    send.mockImplementation(async (_dataset: string, _token: string, events: OutgoingEvent[]) => {
      if (events.some((outgoing) => outgoing.leadId === refusedLead)) throw new ConversionsApiError("REFUSED", "Неверное значение event_time");
      sent.push(events);
    });

    await worker().runOnce();

    expect(sent.flat().map((outgoing) => outgoing.leadId).sort()).toEqual([leads[0]!.id, leads[2]!.id].sort());
    const rows = await prisma.metaConversionSend.findMany({ include: { lead: true }, orderBy: { reachedAt: "asc" } });
    expect(rows.map((row) => [row.lead.name, row.status, row.lastError])).toEqual([
      ["Жанна", "SENT", null],
      ["Зоя", "FAILED", "Неверное значение event_time"],
      ["Ира", "SENT", null],
    ]);
  });

  it("sends each event once when two workers find the same work", async () => {
    await event("Квал", ["QUALIFIED"]);
    const leads = await Promise.all(Array.from({ length: 6 }, (_, index) => formLead(`Лид ${index}`, `8${index}`)));
    for (const lead of leads) await enters(lead.id, "QUALIFIED");

    await Promise.all([worker().runOnce(), worker().runOnce()]);
    await worker().runOnce();

    const ids = sent.flat().map((outgoing) => outgoing.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(await prisma.metaConversionSend.count({ where: { status: "SENT" } })).toBe(6);
  });
});
