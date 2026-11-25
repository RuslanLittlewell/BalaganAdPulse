import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/composition/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma.js';
import { resetDb, seedProject } from '../helpers/db.js';
import { currentOrg, grantAccess, signInAs, type SignedIn } from '../helpers/auth.js';

const app = createApp();
const CT_NAME = 'US | CT | Leads | Leadprogram | consumer | TOF | 17.09.26';
let admin: SignedIn;
let orgId: string, clientId: string, projectId: string;
let ct: string, oh: string, adSet: string, ad: string, knownPerson: string;

beforeEach(async () => {
  await resetDb();
  orgId = (await currentOrg()).id;
  admin = await signInAs('Admin');
  ({ clientId, projectId } = await seedProject(admin.user.id, 'Gealan'));
  ct = (await prisma.campaign.create({ data: { projectId, name: CT_NAME, channel: 'META', externalId: '120251441942930251', position: 0 } })).id;
  oh = (await prisma.campaign.create({ data: { projectId, name: 'US | OH | Leads', channel: 'META', externalId: '120251860075170251', position: 1 } })).id;
  adSet = (await prisma.adSet.create({ data: { campaignId: oh, name: 'Broad', externalId: '120251860000000000', position: 0 } })).id;
  ad = (await prisma.ad.create({ data: { adSetId: adSet, name: '2 creo | vid | broad - Denis', externalId: '120251497757350251', position: 0 } })).id;
  const onBoard = (await prisma.person.create({ data: { orgId, clientId, name: 'Akex', phone: '+1 (203) 850-3236' } })).id;
  await prisma.lead.create({ data: { orgId, projectId, name: 'Akex', personId: onBoard, origin: 'META', stage: 'NEW', position: 0 } });
  knownPerson = (await prisma.person.create({ data: { orgId, clientId, name: 'Gabriela S.', email: 'G@example.com' } })).id;
});
afterAll(() => prisma.$disconnect());

const base = (board = projectId) => `/api/crm/boards/${board}/imports`;
const ROWS = [
  {
    name: 'Gabriela', phone: '+12039521110', email: 'g@example.com', submittedAt: '2026-11-20T03:46:21.657Z', campaign: '120251441942930251',
    utmSource: 'Facebook_Mobile_Reels', utmMedium: CT_NAME, utmTerm: '120251442209330251',
    answers: [{ question: 'What stage are you at?', values: ['I want to know the price'] }, { question: 'platform', values: ['quiz'] }],
  },
  { name: 'Jeff', phone: '+12035091636', submittedAt: '2026-09-22T06:38:09+03:00', campaign: 'ag:120251497757350251', utmSource: 'fb', status: 'Qualified' },
  { name: 'Akex', phone: '+12038503236', campaign: '120251441942930251' },
  { name: 'Michelle', email: 'MICHELLE@example.com', campaign: '120248687922870485' },
  { name: 'Michelle again', email: 'michelle@example.com', campaign: '120248687922870485' },
  { name: '', phone: null, email: '  ' },
];
const imported = () => prisma.lead.findMany({ where: { projectId, origin: 'IMPORT' }, include: { webSource: true, person: true }, orderBy: { position: 'asc' } });

describe('reading a table', () => {
  it('reads a CSV text into columns and rows', async () => {
    const res = await request(app).post(`${base()}/table`).set(admin.auth).send({ csv: 'Имя;Телефон\n"Иван";+7 900\n' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ columns: ['Имя', 'Телефон'], rows: [['Иван', '+7 900']] });
  });

  it('refuses a link that is not a Google Sheet without fetching it', async () => {
    const res = await request(app).post(`${base()}/table`).set(admin.auth).send({ url: 'http://127.0.0.1:5432/spreadsheets/d/abcdefghijkl' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ code: 'NOT_A_SHEET' }]);
  });

  it('takes a table up to 10 MB', async () => {
    const csv = `name,notes\n${`Ann,${'x'.repeat(2000)}\n`.repeat(4000)}`;

    const res = await request(app).post(`${base()}/table`).set(admin.auth).send({ csv });

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(4000);
  });
});

describe('previewing an import', () => {
  it('counts what will be added and skipped and finds each value’s campaign', async () => {
    const res = await request(app).post(`${base()}/preview`).set(admin.auth).send({ rows: ROWS });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      added: 3,
      skipped: { onBoard: 1, repeated: 1, empty: 1 },
      undated: 1,
      campaigns: [
        { value: '120251441942930251', leads: 1, campaign: { id: ct, name: CT_NAME } },
        { value: 'ag:120251497757350251', leads: 1, campaign: { id: oh, name: 'US | OH | Leads' } },
        { value: '120248687922870485', leads: 1, campaign: null },
      ],
      statuses: [{ value: 'Qualified', leads: 1, column: { id: 'QUALIFIED', name: 'Квалифицированный' } }],
    });
    expect(await imported()).toEqual([]);
  });
});

describe('importing leads', () => {
  const run = (as = admin.auth, board = projectId, choices = [{ value: '120248687922870485', campaignId: ct }]) =>
    request(app).post(base(board)).set(as).send({ rows: ROWS, choices });

  it('adds the leads on top of their columns, newest first, with their campaigns, dates, tags and answers', async () => {
    const res = await run();

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ added: 3, skipped: { onBoard: 1, repeated: 1, empty: 1 } });
    const leads = await imported();
    expect(leads.map((lead) => [lead.name, lead.stage, lead.position, lead.campaignId, lead.adId])).toEqual([
      ['Michelle', 'NEW', 0, ct, null],
      ['Jeff', 'QUALIFIED', 0, oh, ad],
      ['Gabriela', 'NEW', 1, ct, null],
    ]);
    const [, jeff, gabriela] = leads;
    expect(jeff!.createdAt.toISOString()).toBe('2026-09-22T03:38:09.000Z');
    expect(jeff!.webSource?.submittedAt.toISOString()).toBe('2026-09-22T03:38:09.000Z');
    expect(gabriela!.webSource).toMatchObject({
      utmSource: 'Facebook_Mobile_Reels', utmMedium: CT_NAME, utmCampaign: null, utmTerm: '120251442209330251',
      answers: [{ question: 'What stage are you at?', values: ['I want to know the price'] }, { question: 'platform', values: ['quiz'] }],
    });
    expect(gabriela!.personId).toBe(knownPerson);
    expect(jeff!.person).toMatchObject({ name: 'Jeff', phone: '+12035091636' });
    expect(await prisma.lead.findFirstOrThrow({ where: { projectId, name: 'Akex', origin: 'META' } })).toMatchObject({ position: 2 });
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityType: 'project', entityId: projectId, action: 'UPDATE' } });
    expect(audit.summary).toBe('Imported 3 leads into project “Gealan”');
  });

  it('shows the lead on the card with the origin IMPORT and its source', async () => {
    await run();

    const list = (await request(app).get(`/api/crm/boards/${projectId}/leads`).set(admin.auth)).body as Array<{ name: string; origin: string; webSource: unknown }>;

    expect(list.find((lead) => lead.name === 'Jeff')).toMatchObject({ origin: 'IMPORT', webSource: { utmSource: 'fb', submittedAt: '2026-09-22T03:38:09.000Z' } });
  });

  it('adds nothing when the same table is imported again', async () => {
    await run();

    const again = await run();

    expect(again.status).toBe(201);
    expect(again.body).toEqual({ added: 0, skipped: { onBoard: 5, repeated: 0, empty: 1 } });
    expect(await imported()).toHaveLength(3);
  });

  it('leaves a value without a campaign when the member chooses none', async () => {
    await run(admin.auth, projectId, []);

    expect((await imported()).find((lead) => lead.name === 'Michelle')?.campaignId).toBeNull();
  });

  it('refuses a chosen campaign of another project', async () => {
    const other = await seedProject(admin.user.id, 'Window Hub');
    const foreign = (await prisma.campaign.create({ data: { projectId: other.projectId, name: 'Foreign', channel: 'META', position: 0 } })).id;

    const res = await run(admin.auth, projectId, [{ value: '120248687922870485', campaignId: foreign }]);

    expect(res.status).toBe(400);
    expect(await imported()).toEqual([]);
  });

  it('lets the partner of the campaign see the imported leads of that campaign only', async () => {
    const dealer = await signInAs('Dealer', { role: 'PARTNER' });
    await prisma.partnerCampaign.create({ data: { membershipId: dealer.membership!.id, campaignId: ct } });
    await run();

    const seen = (await request(app).get(`/api/crm/boards/${projectId}/leads`).set(dealer.auth)).body as Array<{ name: string }>;

    expect(seen.map((lead) => lead.name).sort()).toEqual(['Gabriela', 'Michelle']);
  });

  it('counts a lead on the day of its row', async () => {
    await run();

    const res = await request(app).get(`/api/crm/boards/${projectId}/stage-counts?from=2026-09-01&to=2026-09-30`).set(admin.auth);

    expect(res.body.campaigns).toEqual([{ campaignId: oh, NEW: 0, QUALIFIED: 1, TARGET: 0, PROPOSAL: 0 }]);
  });

  it('places a status in the board’s own column or the column picked for it, on top of the leads there', async () => {
    const measure = (await prisma.leadColumn.create({ data: { orgId, projectId, name: 'Замер', afterStage: 'QUALIFIED', position: 0 } })).id;
    const waiting = (await prisma.person.create({ data: { orgId, clientId, name: 'Waiting' } })).id;
    await prisma.lead.create({ data: { orgId, projectId, name: 'Waiting', personId: waiting, stage: null, columnId: measure, position: 0 } });
    const rows = [
      { name: 'Measured', phone: '+15550000001', status: 'замер', submittedAt: '2026-10-02T10:00:00Z' },
      { name: 'Working', phone: '+15550000002', status: 'В работе', submittedAt: '2026-10-01T10:00:00Z' },
      { name: 'Later', phone: '+15550000003', status: 'Позже' },
    ];

    const res = await request(app).post(base()).set(admin.auth).send({ rows, placements: [{ value: 'В работе', columnId: measure }] });

    expect(res.status).toBe(201);
    const placed = await prisma.lead.findMany({ where: { projectId }, orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { name: true, stage: true, columnId: true, position: true } });
    expect(placed.filter((lead) => lead.columnId === measure).map((lead) => [lead.name, lead.position])).toEqual([['Measured', 0], ['Working', 1], ['Waiting', 2]]);
    expect(placed.find((lead) => lead.name === 'Later')).toMatchObject({ stage: 'NEW', columnId: null, position: 0 });
  });

  it('refuses a picked column of another board', async () => {
    const other = await seedProject(admin.user.id, 'Window Hub');
    const foreign = (await prisma.leadColumn.create({ data: { orgId, projectId: other.projectId, name: 'Чужой', position: 0 } })).id;

    const res = await request(app).post(base()).set(admin.auth).send({ rows: [{ name: 'A', status: 'x' }], placements: [{ value: 'x', columnId: foreign }] });

    expect(res.status).toBe(400);
    expect(await imported()).toEqual([]);
  });
});

describe('who may import', () => {
  it('lets a client admin import into a project of their own client only', async () => {
    const principal = await signInAs('Principal', { role: 'CLIENT_ADMIN' });
    await grantAccess(principal.membership!.id, clientId);
    const other = await seedProject(admin.user.id, 'Window Hub');

    expect((await request(app).post(base()).set(principal.auth).send({ rows: ROWS })).status).toBe(201);
    expect((await request(app).post(base(other.projectId)).set(principal.auth).send({ rows: ROWS })).status).toBe(404);
    expect((await request(app).post(`${base(other.projectId)}/preview`).set(principal.auth).send({ rows: ROWS })).status).toBe(404);
  });

  it.each(['MANAGER', 'CLIENT', 'GUEST'] as const)('refuses %s', async (role) => {
    const member = await signInAs('Member', { role });
    await grantAccess(member.membership!.id, clientId);

    for (const [path, body] of [['/table', { csv: 'name\nAnn' }], ['/preview', { rows: ROWS }], ['', { rows: ROWS }]] as const) {
      expect((await request(app).post(`${base()}${path}`).set(member.auth).send(body)).status, path).toBe(403);
    }
    expect(await imported()).toEqual([]);
  });

  it('refuses a partner', async () => {
    const dealer = await signInAs('Dealer', { role: 'PARTNER' });
    await prisma.partnerCampaign.create({ data: { membershipId: dealer.membership!.id, campaignId: ct } });

    expect((await request(app).post(base()).set(dealer.auth).send({ rows: ROWS })).status).toBe(403);
  });
});
