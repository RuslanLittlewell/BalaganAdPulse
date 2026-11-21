import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { Bitrix24Error, createBitrix24Worker, createSyncEngine } from "../../src/modules/bitrix24/index.js";
import { Bitrix24Secrets } from "../../src/modules/bitrix24/infrastructure/bitrix24-secrets.js";
import { PrismaConnectionRepository } from "../../src/modules/bitrix24/infrastructure/prisma-connection-repository.js";
import { PrismaSyncStore } from "../../src/modules/bitrix24/infrastructure/prisma-sync-store.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";
import { FakePortal } from "./fake-portal.js";

const connections = new PrismaConnectionRepository(prisma);
const store = new PrismaSyncStore(prisma);
const secrets = new Bitrix24Secrets(process.env.INTEGRATION_ENCRYPTION_KEY);
const announced: string[] = [];
let portal: FakePortal;
const engine = createSyncEngine({ store, announce: { leadsChanged: (_orgId, projectId) => announced.push(projectId) } });
const worker = createBitrix24Worker({ connections, store, engine, apis: { open: () => portal }, secrets, clock: { now: () => new Date() } });

let orgId: string;
let projectId: string;
let clientId: string;
let connectionId: string;
let memberEmail: string;
let membershipId: string;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tick = () => worker.tick();
const link = (kind: string, localId: string) =>
  prisma.bitrix24Link.findUnique({ where: { connectionId_kind_localId: { connectionId, kind, localId } } });
const remoteOf = async (kind: string, localId: string) => (await link(kind, localId))!.remoteId;
const event = (kind: string, remoteId: string) => prisma.bitrix24Inbox.create({ data: { connectionId, kind, remoteId } });
const createLead = (data: Record<string, unknown> = {}) =>
  prisma.lead.create({ data: { orgId, projectId, name: "Анна", stage: "NEW", position: 0, amount: "1500", source: "Instagram", ...data } });

beforeEach(async () => {
  await resetDb();
  portal = new FakePortal();
  announced.length = 0;
  const member = await signInAs("Olga");
  memberEmail = member.user.email!;
  membershipId = member.membership!.id;
  ({ projectId, clientId } = await seedProject(member.user.id, "Клиника"));
  orgId = (await currentOrg()).id;
  const created = await connections.create({
    orgId,
    portalHost: "acme.bitrix24.ru",
    sealedWebhook: secrets.seal("https://acme.bitrix24.ru/rest/1/abc/", orgId),
    tokenHash: secrets.hash("token"),
    webhookKey: "key-1",
    connectedAt: new Date(Date.now() - 60_000),
  });
  connectionId = created.id;
  await connections.update(connectionId, { inboundProjectId: projectId });
  await connections.setStageLinks(connectionId, [{ stageKey: "NEW", statusId: "NEW" }, { stageKey: "QUALIFIED", statusId: "IN_PROCESS" }]);
});

afterAll(() => prisma.$disconnect());

describe("leads", () => {
  it("sends a lead created in AdPulse with its fields and mapped status", async () => {
    const lead = await createLead({ stage: "QUALIFIED" });

    await tick();

    const remote = portal.entities.lead.get(await remoteOf("LEAD", lead.id))!;
    expect(remote).toMatchObject({ TITLE: "Анна", OPPORTUNITY: "1500", SOURCE_DESCRIPTION: "Instagram", STATUS_ID: "IN_PROCESS" });
    expect((await prisma.bitrix24Connection.findUniqueOrThrow({ where: { id: connectionId } })).lastSyncAt).not.toBeNull();
  });

  it("leaves leads that existed before connecting where they are", async () => {
    await createLead({ createdAt: new Date(Date.now() - 3_600_000) });

    await tick();

    expect(portal.entities.lead.size).toBe(0);
  });

  it("creates a lead that starts in Bitrix24 in the inbound project, in the mapped column", async () => {
    const remoteId = portal.seed("lead", { TITLE: "Из портала", STATUS_ID: "IN_PROCESS", OPPORTUNITY: "300.00" });
    await event("LEAD", remoteId);

    await tick();

    const local = await prisma.lead.findFirstOrThrow({ where: { name: "Из портала" } });
    expect(local).toMatchObject({ projectId, stage: "QUALIFIED", position: 0 });
    expect(local.amount?.toString()).toBe("300");
    expect(announced).toContain(projectId);
    expect(await prisma.bitrix24Inbox.count()).toBe(0);
  });

  it("skips leads from Bitrix24 while no inbound project is chosen, then takes them once one is", async () => {
    await connections.update(connectionId, { inboundProjectId: null });
    const remoteId = portal.seed("lead", { TITLE: "Ждёт проекта", STATUS_ID: "NEW" });
    await event("LEAD", remoteId);

    await tick();
    expect(await prisma.lead.count({ where: { name: "Ждёт проекта" } })).toBe(0);
    expect(await connections.problems(connectionId)).toEqual([expect.objectContaining({ reason: "NO_INBOUND_PROJECT", key: `remote:${remoteId}` })]);

    await connections.update(connectionId, { inboundProjectId: projectId });
    await connections.requeueSkipped(connectionId);
    await tick();

    expect(await prisma.lead.count({ where: { name: "Ждёт проекта" } })).toBe(1);
    expect(await connections.problems(connectionId)).toEqual([]);
  });

  it("ignores an event for a Bitrix24 lead created before connecting", async () => {
    const remoteId = portal.seed("lead", { TITLE: "Старый" }, new Date(Date.now() - 3_600_000).toISOString());
    await event("LEAD", remoteId);

    await tick();

    expect(await prisma.lead.count({ where: { name: "Старый" } })).toBe(0);
  });

  it("carries edits from both sides", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);

    await prisma.lead.update({ where: { id: lead.id }, data: { amount: "2000" } });
    await tick();
    await sleep(5);
    portal.edit("lead", remoteId, { TITLE: "Анна Ковалёва" });
    await event("LEAD", remoteId);
    await tick();

    const local = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(local.name).toBe("Анна Ковалёва");
    expect(local.amount?.toString()).toBe("2000");
    expect(portal.entities.lead.get(remoteId)).toMatchObject({ TITLE: "Анна Ковалёва", OPPORTUNITY: "2000" });
  });

  it("moves a lead to the column mapped to its new status", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);

    await sleep(5);
    portal.edit("lead", remoteId, { STATUS_ID: "IN_PROCESS" });
    await event("LEAD", remoteId);
    await tick();

    expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ stage: "QUALIFIED", position: 0 });
  });

  it("keeps the stage and reports a status that no stage maps to", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);

    await sleep(5);
    portal.edit("lead", remoteId, { STATUS_ID: "PROCESSED", TITLE: "Переименован" });
    await event("LEAD", remoteId);
    await tick();

    expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ stage: "NEW", name: "Переименован" });
    expect(await connections.problems(connectionId)).toEqual([expect.objectContaining({ kind: "STATUS", key: "PROCESSED", reason: "UNMAPPED_STATUS" })]);
  });
});

describe("the later change wins and never echoes", () => {
  it("takes the Bitrix24 edit when it is later than the AdPulse edit", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);

    await prisma.lead.update({ where: { id: lead.id }, data: { name: "Из AdPulse" } });
    await sleep(5);
    portal.edit("lead", remoteId, { TITLE: "Из Битрикс24" });
    await event("LEAD", remoteId);
    await tick();
    await tick();

    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).name).toBe("Из Битрикс24");
    expect(portal.entities.lead.get(remoteId)!.TITLE).toBe("Из Битрикс24");
  });

  it("keeps the AdPulse edit when it is later than the Bitrix24 edit", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);

    portal.edit("lead", remoteId, { TITLE: "Из Битрикс24" });
    await sleep(5);
    await prisma.lead.update({ where: { id: lead.id }, data: { name: "Из AdPulse" } });
    await event("LEAD", remoteId);
    await tick();

    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).name).toBe("Из AdPulse");
    expect(portal.entities.lead.get(remoteId)!.TITLE).toBe("Из AdPulse");
  });

  it("recognizes the portal's report of its own write", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);
    const before = (await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).updatedAt;
    const writes = portal.writes("crm.lead").length;

    await event("LEAD", remoteId);
    await tick();
    await tick();

    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).updatedAt).toEqual(before);
    expect(portal.writes("crm.lead")).toHaveLength(writes);
  });
});

describe("contacts and companies", () => {
  it("sends a person attached to a lead and attaches the contact", async () => {
    const person = await prisma.person.create({ data: { orgId, clientId, name: "Иван", phone: "+375291112233", email: "ivan@acme.by" } });
    const lead = await createLead({ personId: person.id });

    await tick();

    const contactId = await remoteOf("PERSON", person.id);
    expect(portal.entities.contact.get(contactId)).toMatchObject({ NAME: "Иван", PHONE: [{ VALUE: "+375291112233", VALUE_TYPE: "WORK" }] });
    expect(portal.entities.lead.get(await remoteOf("LEAD", lead.id))!.CONTACT_ID).toBe(contactId);
  });

  it("brings a company attached in Bitrix24 under the lead's client", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);
    const companyId = portal.seed("company", { TITLE: "ООО Ромашка", WEB: [{ VALUE: "romashka.by" }] });

    await sleep(5);
    portal.edit("lead", remoteId, { COMPANY_ID: companyId });
    await event("LEAD", remoteId);
    await tick();

    const local = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { company: true } });
    expect(local.company).toMatchObject({ name: "ООО Ромашка", website: "romashka.by", clientId });
  });
});

describe("notes and comments", () => {
  it("turns a note into a comment on the Bitrix24 lead, and a comment into a note", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);
    await prisma.leadNote.create({ data: { orgId, leadId: lead.id, authorId: membershipId, body: "Перезвонить в пятницу" } });

    await tick();

    expect([...portal.comments.values()]).toEqual([expect.objectContaining({ ENTITY_ID: Number(remoteId), ENTITY_TYPE: "lead", COMMENT: "Olga: Перезвонить в пятницу" })]);

    portal.users.push({ ID: "7", NAME: "Пётр", LAST_NAME: "Сидоров", EMAIL: "petr@acme.by" });
    const commentId = portal.seedComment({ ENTITY_ID: remoteId, ENTITY_TYPE: "lead", COMMENT: "Клиент согласен", AUTHOR_ID: "7" });
    await event("NOTE", commentId);
    await tick();

    const notes = await prisma.leadNote.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" } });
    expect(notes.map((note) => note.body)).toEqual(["Перезвонить в пятницу", "Пётр Сидоров: Клиент согласен"]);
  });
});

describe("lead tasks", () => {
  it("sends a task of a linked lead bound to it, and finishes it when Bitrix24 does", async () => {
    portal.users.push({ ID: "3", NAME: "Olga", EMAIL: memberEmail });
    const lead = await createLead();
    await tick();
    const task = await prisma.task.create({
      data: { orgId, projectId, leadId: lead.id, title: "Позвонить", column: "QUEUED", priority: "MEDIUM", position: 0, dueDate: new Date("2026-12-01"), assigneeId: membershipId },
    });

    await tick();

    const remoteTaskId = await remoteOf("TASK", task.id);
    expect(portal.tasks.get(remoteTaskId)).toMatchObject({
      title: "Позвонить", ufCrmTask: [`L_${await remoteOf("LEAD", lead.id)}`], responsibleId: "3",
    });

    await sleep(5);
    portal.editTask(remoteTaskId, { status: "5" });
    await event("TASK", remoteTaskId);
    await tick();

    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ column: "DONE" });
  });

  it("sends nothing for a task that belongs to no lead", async () => {
    await prisma.task.create({ data: { orgId, projectId, title: "Своя задача", column: "QUEUED", priority: "MEDIUM", position: 0 } });

    await tick();

    expect(portal.tasks.size).toBe(0);
  });

  it("carries task comments both ways", async () => {
    const lead = await createLead();
    await tick();
    const task = await prisma.task.create({ data: { orgId, projectId, leadId: lead.id, title: "Позвонить", column: "QUEUED", priority: "MEDIUM", position: 0 } });
    await tick();
    await prisma.taskComment.create({ data: { taskId: task.id, authorId: membershipId, body: "Набрала, не ответил", mentionIds: [] } });

    await tick();
    const remoteTaskId = await remoteOf("TASK", task.id);
    expect([...portal.taskComments.values()]).toEqual([expect.objectContaining({ TASK_ID: remoteTaskId, POST_MESSAGE: "Olga: Набрала, не ответил" })]);

    const key = portal.seedTaskComment(remoteTaskId, { POST_MESSAGE: "Перезвоню сам", AUTHOR_NAME: "Пётр" });
    await event("COMMENT", key);
    await tick();

    expect((await prisma.taskComment.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "asc" } })).map((comment) => comment.body))
      .toEqual(["Набрала, не ответил", "Пётр: Перезвоню сам"]);
  });
});

describe("failures", () => {
  it("keeps an edit made while the portal is down and sends it once it answers", async () => {
    portal.failWith(new Bitrix24Error("TRANSIENT", "down"));
    const lead = await createLead();

    await tick();
    expect(await link("LEAD", lead.id)).toBeNull();
    expect((await prisma.bitrix24Connection.findUniqueOrThrow({ where: { id: connectionId } })).lastError).toBe("TRANSIENT");

    portal.heal();
    await tick();

    expect(portal.entities.lead.get(await remoteOf("LEAD", lead.id))!.TITLE).toBe("Анна");
  });

  it("marks a refused change failed with its reason and sends the next one", async () => {
    portal.failWith(new Bitrix24Error("REFUSED", "TITLE is too long"), "crm.lead.add", 1);
    const first = await createLead({ name: "Первый" });
    await sleep(5);
    const second = await createLead({ name: "Второй" });

    await tick();
    await tick();

    expect(await link("LEAD", first.id)).toBeNull();
    expect(await link("LEAD", second.id)).not.toBeNull();
    expect(await connections.problems(connectionId)).toEqual([
      expect.objectContaining({ kind: "LEAD", key: first.id, label: "Первый", reason: "REFUSED: TITLE is too long" }),
    ]);
  });

  it("stops and asks for a new address when the webhook is revoked, then resumes", async () => {
    portal.failWith(new Bitrix24Error("AUTH", "INVALID_CREDENTIALS"));
    const lead = await createLead();

    await tick();
    expect((await prisma.bitrix24Connection.findUniqueOrThrow({ where: { id: connectionId } })).status).toBe("AUTH_REQUIRED");

    portal.heal();
    const calls = portal.calls.length;
    await tick();
    expect(portal.calls).toHaveLength(calls);

    await connections.update(connectionId, { status: "ACTIVE", lastError: null });
    await tick();
    expect(await link("LEAD", lead.id)).not.toBeNull();
  });
});

describe("deleting", () => {
  it("leaves the Bitrix24 lead when the AdPulse lead is deleted", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);

    await prisma.lead.delete({ where: { id: lead.id } });
    await sleep(5);
    portal.edit("lead", remoteId, { TITLE: "Живой" });
    await event("LEAD", remoteId);
    await tick();

    expect(portal.entities.lead.has(remoteId)).toBe(true);
    expect(await prisma.lead.count({ where: { name: "Живой" } })).toBe(0);
    expect((await link("LEAD", lead.id))!.dropped).toBe(true);
  });

  it("leaves the AdPulse lead when the Bitrix24 lead is deleted, and does not recreate it", async () => {
    const lead = await createLead();
    await tick();
    const remoteId = await remoteOf("LEAD", lead.id);

    portal.entities.lead.delete(remoteId);
    await event("LEAD", remoteId);
    await tick();
    await prisma.lead.update({ where: { id: lead.id }, data: { name: "Правка" } });
    await tick();

    expect(await prisma.lead.count({ where: { id: lead.id } })).toBe(1);
    expect(portal.entities.lead.size).toBe(0);
    expect(portal.writes("crm.lead.add")).toHaveLength(1);
  });
});

describe("moving existing records", () => {
  it("uploads every unlinked lead, contact and company", async () => {
    const old = new Date(Date.now() - 3_600_000);
    const company = await prisma.company.create({ data: { orgId, clientId, name: "ООО Старое", createdAt: old } });
    await createLead({ name: "Старый лид", companyId: company.id, createdAt: old });
    const run = await connections.startRun(connectionId, "UPLOAD");

    await tick();
    await tick();

    expect([...portal.entities.lead.values()].map((lead) => lead.TITLE)).toEqual(["Старый лид"]);
    expect([...portal.entities.company.values()].map((row) => row.TITLE)).toEqual(["ООО Старое"]);
    expect(await connections.latestRun(connectionId)).toMatchObject({ id: run!.id, state: "DONE", created: 2, failed: 0 });
  });

  it("downloads every unlinked Bitrix24 record, old ones too", async () => {
    portal.seed("lead", { TITLE: "Давний лид", STATUS_ID: "NEW" }, new Date(Date.now() - 86_400_000).toISOString());
    portal.seed("contact", { NAME: "Давний", LAST_NAME: "Контакт" }, new Date(Date.now() - 86_400_000).toISOString());
    await connections.startRun(connectionId, "DOWNLOAD");

    for (let step = 0; step < 4; step++) await tick();

    expect(await prisma.lead.count({ where: { name: "Давний лид", projectId } })).toBe(1);
    expect(await prisma.person.count({ where: { name: "Давний Контакт", clientId } })).toBe(1);
    expect(await connections.latestRun(connectionId)).toMatchObject({ state: "DONE", created: 2 });
  });

  it("refuses a second run while one is going", async () => {
    expect(await connections.startRun(connectionId, "UPLOAD")).not.toBeNull();
    expect(await connections.startRun(connectionId, "DOWNLOAD")).toBeNull();
  });
});

describe("an expired trial", () => {
  it("sends nothing and applies nothing", async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { tariff: "TRIAL", trialEndsAt: new Date(Date.now() - 1000) } });
    await createLead();
    await event("LEAD", portal.seed("lead", { TITLE: "Ждёт" }));

    await tick();

    expect(portal.calls).toEqual([]);
    expect(await prisma.bitrix24Inbox.count()).toBe(1);
  });
});
