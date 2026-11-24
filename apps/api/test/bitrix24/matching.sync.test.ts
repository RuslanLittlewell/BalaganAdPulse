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
const OLD = () => new Date(Date.now() - 3_600_000);
const createLead = (data: Record<string, unknown> = {}) =>
  prisma.lead.create({ data: { orgId, projectId, name: "Анна", stage: "NEW", position: 0, createdAt: OLD(), ...data } });
const createPerson = (data: Record<string, unknown> = {}) =>
  prisma.person.create({ data: { orgId, clientId, name: "Анна Иванова", createdAt: OLD(), ...data } });
const createCompany = (data: Record<string, unknown> = {}) =>
  prisma.company.create({ data: { orgId, clientId, name: "Лода", createdAt: OLD(), ...data } });
const phone = (value: string) => [{ VALUE: value, VALUE_TYPE: "WORK" }];
const email = (value: string) => [{ VALUE: value, VALUE_TYPE: "WORK" }];
const run = async (direction: "UPLOAD" | "DOWNLOAD") => {
  await connections.startRun(connectionId, direction);
  for (let step = 0; step < 5; step++) await tick();
  return connections.latestRun(connectionId);
};

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


describe("an event for a record that exists in AdPulse", () => {
  it("links a contact whose phone is written in another format instead of creating a person", async () => {
    const person = await createPerson({ phone: "375291112233" });
    const remoteId = portal.seed("contact", { NAME: "Анна", LAST_NAME: "Иванова", PHONE: phone("+375 (29) 111-22-33") });
    await event("PERSON", remoteId);

    await tick();

    expect(await prisma.person.count()).toBe(1);
    expect(await remoteOf("PERSON", person.id)).toBe(remoteId);
    expect((await prisma.person.findUniqueOrThrow({ where: { id: person.id } })).name).toBe("Анна Иванова");
  });

  it("links a contact whose email differs only in case", async () => {
    const person = await createPerson({ email: "Anna@Example.com" });
    const remoteId = portal.seed("contact", { NAME: "Анна", EMAIL: email("anna@example.com") });
    await event("PERSON", remoteId);

    await tick();

    expect(await prisma.person.count()).toBe(1);
    expect(await remoteOf("PERSON", person.id)).toBe(remoteId);
  });

  it("links a company by its name, ignoring case and spaces", async () => {
    const company = await createCompany({ name: "Лода " });
    const remoteId = portal.seed("company", { TITLE: "лода" });
    await event("COMPANY", remoteId);

    await tick();

    expect(await prisma.company.count()).toBe(1);
    expect(await remoteOf("COMPANY", company.id)).toBe(remoteId);
  });

  it("links a company by the host of its website", async () => {
    const company = await createCompany({ name: "ООО Лода", website: "loda.by" });
    const remoteId = portal.seed("company", { TITLE: "Loda", WEB: [{ VALUE: "https://www.loda.by/", VALUE_TYPE: "WORK" }] });
    await event("COMPANY", remoteId);

    await tick();

    expect(await prisma.company.count()).toBe(1);
    expect(await remoteOf("COMPANY", company.id)).toBe(remoteId);
  });

  it("links a lead of the same name whose contact matches, and links its contact too", async () => {
    const person = await createPerson({ phone: "375291112233" });
    const lead = await createLead({ personId: person.id });
    const contactId = portal.seed("contact", { NAME: "Анна", PHONE: phone("+375 29 111 22 33") });
    const remoteId = portal.seed("lead", { TITLE: " анна", STATUS_ID: "NEW", CONTACT_ID: contactId });
    await event("LEAD", remoteId);

    await tick();

    expect(await prisma.lead.count()).toBe(1);
    expect(await remoteOf("LEAD", lead.id)).toBe(remoteId);
    expect(portal.writes()).toEqual([]);
  });

  it("creates a second lead when only the name is the same", async () => {
    const person = await createPerson({ phone: "375291112233" });
    await createLead({ personId: person.id });
    const otherContact = portal.seed("contact", { NAME: "Другой", PHONE: phone("375445556677") });
    const withOtherContact = portal.seed("lead", { TITLE: "Анна", STATUS_ID: "NEW", CONTACT_ID: otherContact });
    const withoutContact = portal.seed("lead", { TITLE: "Анна", STATUS_ID: "NEW" });
    await event("LEAD", withOtherContact);
    await event("LEAD", withoutContact);

    await tick();

    expect(await prisma.lead.count({ where: { projectId } })).toBe(3);
  });

  it("links the older of two people who match", async () => {
    const older = await createPerson({ phone: "375291112233", createdAt: new Date(Date.now() - 7_200_000) });
    const newer = await createPerson({ phone: "375291112233", name: "Анна дубль" });
    const remoteId = portal.seed("contact", { NAME: "Анна", PHONE: phone("375291112233") });
    await event("PERSON", remoteId);

    await tick();

    expect(await prisma.person.count()).toBe(2);
    expect(await remoteOf("PERSON", older.id)).toBe(remoteId);
    expect(await link("PERSON", newer.id)).toBeNull();
  });

  it("does not take a person that is linked to another contact", async () => {
    const taken = await createPerson({ phone: "375291112233" });
    const first = portal.seed("contact", { NAME: "Анна", PHONE: phone("375291112233") });
    await event("PERSON", first);
    await tick();
    const second = portal.seed("contact", { NAME: "Анна вторая", PHONE: phone("375291112233") });
    await event("PERSON", second);

    await tick();

    expect(await remoteOf("PERSON", taken.id)).toBe(first);
    expect(await prisma.person.count()).toBe(2);
  });

  it("does not match a person of another client", async () => {
    const other = await prisma.client.create({ data: { orgId, name: "Другой клиент" } });
    await prisma.person.create({ data: { orgId, clientId: other.id, name: "Анна", phone: "375291112233", createdAt: OLD() } });
    const remoteId = portal.seed("contact", { NAME: "Анна", PHONE: phone("375291112233") });
    await event("PERSON", remoteId);

    await tick();

    expect(await prisma.person.count({ where: { clientId } })).toBe(1);
    expect(await prisma.person.count()).toBe(2);
  });

  it("matches the contact of a new lead before it creates one", async () => {
    const person = await createPerson({ email: "anna@example.com" });
    const contactId = portal.seed("contact", { NAME: "Анна", EMAIL: email("ANNA@example.com") });
    const remoteId = portal.seed("lead", { TITLE: "Новый лид", STATUS_ID: "NEW", CONTACT_ID: contactId });
    await event("LEAD", remoteId);

    await tick();

    const lead = await prisma.lead.findFirstOrThrow({ where: { name: "Новый лид" } });
    expect(lead.personId).toBe(person.id);
    expect(await prisma.person.count()).toBe(1);
  });
});

describe("sending a record that exists on the portal", () => {
  it("links a person to the contact with the same phone and sends nothing", async () => {
    const remoteId = portal.seed("contact", { NAME: "Анна", PHONE: phone("+375 (29) 111-22-33") });
    const person = await createPerson({ phone: "375291112233", createdAt: new Date() });

    await tick();

    expect(await remoteOf("PERSON", person.id)).toBe(remoteId);
    expect(portal.writes("crm.contact")).toEqual([]);
    expect(portal.entities.contact.size).toBe(1);
  });

  it("links a person by email and prefers the oldest contact", async () => {
    const first = portal.seed("contact", { NAME: "Первый", EMAIL: email("anna@example.com") });
    portal.seed("contact", { NAME: "Второй", EMAIL: email("anna@example.com") });
    const person = await createPerson({ email: "Anna@example.com", createdAt: new Date() });

    await tick();

    expect(await remoteOf("PERSON", person.id)).toBe(first);
    expect(portal.entities.contact.size).toBe(2);
  });

  it("links a company to the portal company of the same title", async () => {
    const remoteId = portal.seed("company", { TITLE: "лода" });
    const company = await createCompany({ name: "Лода ", createdAt: new Date() });

    await tick();

    expect(await remoteOf("COMPANY", company.id)).toBe(remoteId);
    expect(portal.writes("crm.company")).toEqual([]);
  });

  it("links a lead to the portal lead of the same title with the same contact", async () => {
    const contactId = portal.seed("contact", { NAME: "Анна", PHONE: phone("375291112233") });
    const remoteId = portal.seed("lead", { TITLE: "Анна", STATUS_ID: "NEW", CONTACT_ID: contactId });
    const person = await createPerson({ phone: "375291112233", createdAt: new Date() });
    const lead = await createLead({ personId: person.id, createdAt: new Date() });

    await tick();

    expect(await remoteOf("PERSON", person.id)).toBe(contactId);
    expect(await remoteOf("LEAD", lead.id)).toBe(remoteId);
    expect(portal.writes()).toEqual([]);
    expect(portal.entities.lead.size).toBe(1);
  });

  it("creates a lead on the portal when only the title is the same", async () => {
    portal.seed("lead", { TITLE: "Анна", STATUS_ID: "NEW" });
    const person = await createPerson({ phone: "375291112233", createdAt: new Date() });
    await createLead({ personId: person.id, createdAt: new Date() });

    await tick();

    expect(portal.entities.lead.size).toBe(2);
  });

  it("does not take a portal record that is linked to another one", async () => {
    const remoteId = portal.seed("contact", { NAME: "Анна", PHONE: phone("375291112233") });
    const first = await createPerson({ phone: "375291112233", createdAt: new Date() });
    await tick();
    const second = await createPerson({ phone: "375291112233", name: "Анна вторая", createdAt: new Date() });

    await tick();

    expect(await remoteOf("PERSON", first.id)).toBe(remoteId);
    expect(await remoteOf("PERSON", second.id)).not.toBe(remoteId);
    expect(portal.entities.contact.size).toBe(2);
  });
});

describe("moving existing records that match", () => {
  it("counts a download of a matching record as linked and the rest as created", async () => {
    const person = await createPerson({ phone: "375291112233" });
    portal.seed("contact", { NAME: "Анна", PHONE: phone("+375 29 111 22 33") }, OLD().toISOString());
    portal.seed("contact", { NAME: "Борис", PHONE: phone("375445556677") }, OLD().toISOString());

    const finished = await run("DOWNLOAD");

    expect(finished).toMatchObject({ state: "DONE", created: 1, linked: 1, failed: 0 });
    expect(await prisma.person.count()).toBe(2);
    expect(await link("PERSON", person.id)).not.toBeNull();
  });

  it("counts an upload of a matching record as linked and sends nothing for it", async () => {
    portal.seed("company", { TITLE: "Лода" }, OLD().toISOString());
    const matching = await createCompany({ name: "Лода" });
    await createCompany({ name: "Евроопт" });

    const finished = await run("UPLOAD");

    expect(finished).toMatchObject({ state: "DONE", created: 1, linked: 1, failed: 0 });
    expect(portal.entities.company.size).toBe(2);
    expect(await link("COMPANY", matching.id)).not.toBeNull();
    expect(portal.writes("crm.company")).toEqual(["crm.company.add"]);
  });

  it("does not link a record twice when the run is repeated", async () => {
    await createPerson({ phone: "375291112233" });
    portal.seed("contact", { NAME: "Анна", PHONE: phone("375291112233") }, OLD().toISOString());
    await run("DOWNLOAD");

    const second = await run("DOWNLOAD");

    expect(second).toMatchObject({ created: 0, linked: 0 });
    expect(await prisma.person.count()).toBe(1);
  });
});
