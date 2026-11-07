import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/composition/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma.js';
import { PrismaUnitOfWork } from '../../src/shared/infrastructure/prisma-unit-of-work.js';
import { RandomIdGenerator } from '../../src/shared/infrastructure/id-generator.js';
import { PrismaCrmRecordRepository } from '../../src/modules/leads/infrastructure/prisma-crm-record-repository.js';
import { createCrmRecordUseCases } from '../../src/modules/leads/application/crm-record-use-cases.js';
import { resetDb, seedProject } from '../helpers/db.js';
import { grantAccess, signInAs, signInAsOutsider } from '../helpers/auth.js';

const app = createApp();
let auth: { Authorization: string };
let actor: NonNullable<Awaited<ReturnType<typeof signInAs>>['actor']>;
let clientId: string;
let projectId: string;
const companies = (client = clientId) => `/api/crm/clients/${client}/companies`;
const people = (client = clientId) => `/api/crm/clients/${client}/people`;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  auth = member.auth;
  actor = member.actor!;
  ({ clientId, projectId } = await seedProject(member.user.id));
});
afterAll(() => prisma.$disconnect());

it('creates, lists, reads and edits records shared by a client', async () => {
  const second = await prisma.project.create({ data: { clientId, name: 'Second', position: 1 } });
  const company = (await request(app).post(companies()).set(auth).send({ name: ' Romashka ', website: 'https://romashka.by' }).expect(201)).body;
  const person = (await request(app).post(people()).set(auth).send({ name: ' Anna ', phone: '+375 (29) 111-22-33', email: 'anna@example.com', companyId: company.id }).expect(201)).body;
  expect(company).toMatchObject({ clientId, name: 'Romashka', website: 'https://romashka.by', peopleCount: 0 });
  expect(person).toMatchObject({ clientId, name: 'Anna', company: { id: company.id, name: 'Romashka' } });
  expect((await prisma.person.findUniqueOrThrow({ where: { id: person.id } })).phoneDigits).toBe('375291112233');
  expect((await request(app).get(companies()).set(auth)).body).toHaveLength(1);
  expect((await request(app).get(people()).set(auth)).body).toHaveLength(1);
  expect((await request(app).get(`${companies()}/${company.id}`).set(auth)).body.people).toHaveLength(1);
  expect((await request(app).patch(`${people()}/${person.id}`).set(auth).send({ phone: '', telegram: '@anna' }).expect(200)).body).toMatchObject({ phone: null, telegram: '@anna' });
  expect((await request(app).patch(`${companies()}/${company.id}`).set(auth).send({ notes: 'Client' }).expect(200)).body.notes).toBe('Client');
  const linked = await request(app).post(`/api/crm/boards/${second.id}/leads`).set(auth).send({ name: 'Deal', personId: person.id, companyId: company.id }).expect(201);
  expect(linked.body).toMatchObject({ personId: person.id, companyId: company.id });
  expect((await request(app).get(`${people()}/${person.id}`).set(auth)).body).toMatchObject({ leadCount: 1, leads: [{ id: linked.body.id, board: { key: second.id } }] });
});

it.each([
  [companies, { name: '' }], [companies, { name: 'A', website: 'javascript:bad' }],
  [companies, { name: 'A', phone: 'x'.repeat(51) }], [people, { name: 'A', email: 'bad' }],
  [people, { name: 'A', notes: 'x'.repeat(10001) }], [people, { name: 'A', unknown: 'value' }],
] as const)('rejects invalid record input', async (path, input) => {
  await request(app).post(path()).set(auth).send(input).expect(400);
  expect(await prisma.person.count()).toBe(0);
  expect(await prisma.company.count()).toBe(0);
});

it('refuses a person linked to another client organization without changing the person', async () => {
  const other = await seedProject('unused', 'Other');
  const foreign = (await request(app).post(companies(other.clientId)).set(auth).send({ name: 'Other' }).expect(201)).body;
  const person = (await request(app).post(people()).set(auth).send({ name: 'Anna' }).expect(201)).body;
  await request(app).post(people()).set(auth).send({ name: 'Bad', companyId: foreign.id }).expect(400);
  await request(app).patch(`${people()}/${person.id}`).set(auth).send({ companyId: foreign.id }).expect(400);
  expect((await prisma.person.findUniqueOrThrow({ where: { id: person.id } })).companyId).toBeNull();
  expect(await prisma.person.count()).toBe(1);
});

it('allows a guest to read a reached client, but blocks writes and hides unreached clients', async () => {
  const company = (await request(app).post(companies()).set(auth).send({ name: 'Romashka' }).expect(201)).body;
  const guest = await signInAs('Guest', { role: 'GUEST' });
  await grantAccess(guest.membership!.id, clientId, projectId);
  const other = await seedProject('unused', 'Other');
  expect((await request(app).get(companies()).set(guest.auth).expect(200)).body).toHaveLength(1);
  await request(app).get(`${companies()}/${company.id}`).set(guest.auth).expect(200);
  await request(app).post(companies()).set(guest.auth).send({ name: 'Blocked' }).expect(403);
  await request(app).patch(`${companies()}/${company.id}`).set(guest.auth).send({ name: 'Blocked' }).expect(403);
  await request(app).delete(`${companies()}/${company.id}`).set(guest.auth).expect(403);
  await request(app).get(people(other.clientId)).set(guest.auth).expect(404);
  await request(app).get(companies(other.clientId)).set(guest.auth).expect(404);
  const outsider = await signInAsOutsider();
  await request(app).get(companies()).set(outsider.auth).expect(404);
});

it('unlinks related people and leads when records are deleted', async () => {
  const company = (await request(app).post(companies()).set(auth).send({ name: 'Romashka' }).expect(201)).body;
  const person = (await request(app).post(people()).set(auth).send({ name: 'Anna', companyId: company.id }).expect(201)).body;
  const lead = (await request(app).post(`/api/crm/boards/${projectId}/leads`).set(auth).send({ name: 'Deal', companyId: company.id, personId: person.id }).expect(201)).body;
  expect((await request(app).get(`${companies()}/${company.id}`).set(auth)).body).toMatchObject({ peopleCount: 1, leadCount: 1 });
  await request(app).delete(`${companies()}/${company.id}`).set(auth).expect(204);
  expect((await prisma.person.findUniqueOrThrow({ where: { id: person.id } })).companyId).toBeNull();
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).companyId).toBeNull();
  expect((await request(app).get(`${people()}/${person.id}`).set(auth)).body.leadCount).toBe(1);
  await request(app).delete(`${people()}/${person.id}`).set(auth).expect(204);
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).personId).toBeNull();
});

it('filters related leads and record audit by client reach', async () => {
  const second = await prisma.project.create({ data: { clientId, name: 'Second', position: 1 } });
  const other = await seedProject('unused', 'Other');
  const company = (await request(app).post(companies()).set(auth).send({ name: 'Romashka' }).expect(201)).body;
  const person = (await request(app).post(people()).set(auth).send({ name: 'Anna', companyId: company.id }).expect(201)).body;
  const otherCompany = (await request(app).post(companies(other.clientId)).set(auth).send({ name: 'Hidden' }).expect(201)).body;
  await request(app).post(`/api/crm/boards/${projectId}/leads`).set(auth).send({ name: 'Visible', personId: person.id, companyId: company.id }).expect(201);
  await request(app).post(`/api/crm/boards/${second.id}/leads`).set(auth).send({ name: 'Hidden lead', personId: person.id, companyId: company.id }).expect(201);
  const manager = await signInAs('Manager', { role: 'MANAGER' });
  await grantAccess(manager.membership!.id, clientId, projectId);
  const detail = (await request(app).get(`${companies()}/${company.id}`).set(manager.auth).expect(200)).body;
  expect(detail).toMatchObject({ leadCount: 1, leads: [{ name: 'Visible' }] });
  expect(detail.people).toHaveLength(1);
  expect((await request(app).get(`${people()}/${person.id}`).set(manager.auth)).body.leads).toHaveLength(1);
  await request(app).get(`${companies(other.clientId)}/${otherCompany.id}`).set(manager.auth).expect(404);
  const audit = (await request(app).get('/api/audit?entityType=crm-company').set(manager.auth).expect(200)).body.items;
  expect(audit.some((event: { entityId: string }) => event.entityId === company.id)).toBe(true);
  expect(audit.some((event: { entityId: string }) => event.entityId === otherCompany.id)).toBe(false);
  expect(await prisma.auditEvent.count({ where: { entityType: 'crm-company' } })).toBe(2);
});

it('publishes one value-free notification for every board after a committed record change', async () => {
  const second = await prisma.project.create({ data: { clientId, name: 'Second', position: 1 } });
  const publish = vi.fn();
  const unitOfWork = new PrismaUnitOfWork(prisma);
  const useCases = createCrmRecordUseCases({
    records: new PrismaCrmRecordRepository(prisma, unitOfWork),
    audit: { append: vi.fn() }, ids: new RandomIdGenerator(), unitOfWork, publish,
  });
  const person = await useCases.createPerson(actor, clientId, { name: 'Anna', phone: '+375291112233' });
  expect(publish.mock.calls).toEqual([
    [{ kind: 'crm.changed', orgId: actor.orgId, board: projectId }],
    [{ kind: 'crm.changed', orgId: actor.orgId, board: second.id }],
  ]);
  publish.mockClear();
  await useCases.updatePerson(actor, clientId, person.id, { email: 'anna@example.com' });
  expect(publish).toHaveBeenCalledTimes(2);
  publish.mockClear();
  await expect(useCases.updatePerson(actor, clientId, person.id, { companyId: '00000000-0000-0000-0000-000000000000' })).rejects.toThrow();
  expect(publish).not.toHaveBeenCalled();
});
