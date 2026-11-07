import { afterAll, beforeEach, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/composition/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma.js';
import { resetDb, seedProject } from '../helpers/db.js';
import { signInAs } from '../helpers/auth.js';

const app = createApp();
let auth: { Authorization: string };
let clientId: string;
let projectId: string;
const leads = () => `/api/crm/boards/${projectId}/leads`;
const companies = (client = clientId) => `/api/crm/clients/${client}/companies`;
const people = (client = clientId) => `/api/crm/clients/${client}/people`;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  auth = member.auth;
  ({ clientId, projectId } = await seedProject(member.user.id));
});
afterAll(() => prisma.$disconnect());

it('links records of the board client and applies contact values to the shared person', async () => {
  const company = (await request(app).post(companies()).set(auth).send({ name: 'Romashka' }).expect(201)).body;
  const person = (await request(app).post(people()).set(auth).send({ name: 'Anna' }).expect(201)).body;
  const first = (await request(app).post(leads()).set(auth).send({ name: 'First', personId: person.id, companyId: company.id, contact: { phone: '+375291234567' }, organization: { website: 'https://romashka.by' } }).expect(201)).body;
  const second = (await request(app).post(leads()).set(auth).send({ name: 'Second', personId: person.id }).expect(201)).body;
  expect(first).toMatchObject({ personId: person.id, companyId: company.id, person: { phone: '+375291234567' }, company: { website: 'https://romashka.by' } });
  const updated = (await request(app).patch(`${leads()}/${first.id}`).set(auth).send({ contact: { email: 'anna@example.com' } }).expect(200)).body;
  expect(updated.person.email).toBe('anna@example.com');
  expect((await request(app).get(`${leads()}/${second.id}`).set(auth)).body.person.email).toBe('anna@example.com');
  expect((await prisma.person.findUniqueOrThrow({ where: { id: person.id } })).email).toBe('anna@example.com');
});

it('creates a named contact and organization atomically when an unlinked lead gets values', async () => {
  const lead = (await request(app).post(leads()).set(auth).send({ name: 'Leonid' }).expect(201)).body;
  expect(lead).toMatchObject({ personId: null, companyId: null });
  const patched = (await request(app).patch(`${leads()}/${lead.id}`).set(auth).send({ contact: { phone: '+375291112233' }, organization: { website: 'https://example.com' } }).expect(200)).body;
  expect(patched).toMatchObject({ person: { name: 'Leonid', phone: '+375291112233' }, company: { name: 'Leonid', website: 'https://example.com' } });
  expect(await prisma.person.count()).toBe(1);
  expect(await prisma.company.count()).toBe(1);
  const activity = (await request(app).get(`${leads()}/${lead.id}/activity`).set(auth).expect(200)).body;
  expect(activity[0].changes).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: 'phone', after: '+375291112233' }),
    expect.objectContaining({ field: 'website', after: 'https://example.com' }),
  ]));
});

it('rejects records from another client and old contact fields without partial writes', async () => {
  const other = await seedProject('unused', 'Other');
  const company = (await request(app).post(companies(other.clientId)).set(auth).send({ name: 'Foreign' }).expect(201)).body;
  const person = (await request(app).post(people(other.clientId)).set(auth).send({ name: 'Foreign' }).expect(201)).body;
  await request(app).post(leads()).set(auth).send({ name: 'Bad', personId: person.id }).expect(400);
  await request(app).post(leads()).set(auth).send({ name: 'Bad', companyId: company.id }).expect(400);
  expect(await prisma.lead.count()).toBe(0);
  const lead = (await request(app).post(leads()).set(auth).send({ name: 'Valid' }).expect(201)).body;
  await request(app).patch(`${leads()}/${lead.id}`).set(auth).send({ personId: person.id, contact: { phone: '123' } }).expect(400);
  await request(app).patch(`${leads()}/${lead.id}`).set(auth).send({ companyId: company.id }).expect(400);
  for (const field of ['company', 'phone', 'email', 'website', 'telegram', 'messenger']) {
    await request(app).post(leads()).set(auth).send({ name: 'Old', [field]: 'value' }).expect(400);
    await request(app).patch(`${leads()}/${lead.id}`).set(auth).send({ [field]: 'value' }).expect(400);
  }
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).personId).toBeNull();
  expect(await prisma.person.count()).toBe(1);
});
