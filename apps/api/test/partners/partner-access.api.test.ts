import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/composition/app.js';
import { createContainer } from '../../src/composition/create-container.js';
import { createRoutes, ROUTE_MOUNTS } from '../../src/composition/create-routes.js';
import { prisma } from '../../src/shared/infrastructure/prisma.js';
import { PrismaMembershipDirectory } from '../../src/modules/members/infrastructure/prisma-membership-directory.js';
import { resetDb, seedCampaign, seedProject } from '../helpers/db.js';
import { currentOrg, grantAccess, signInAs, type SignedIn } from '../helpers/auth.js';

const app = createApp();
const range = 'from=2026-11-01&to=2026-11-30';
let admin: SignedIn, dealer: SignedIn;
let orgId: string, clientId: string, projectId: string, otherProject: string;
let foreignAdSet: string, foreignAd: string, foreignCreative: string;
let ownCampaign: string, foreignCampaign: string, ownLead: string, foreignLead: string, ownPerson: string, foreignPerson: string, ownCompany: string, foreignCompany: string;
const board = () => `/api/crm/boards/${projectId}`;
const read = (path: string, as = dealer) => request(app).get(path).set(as.auth);

beforeEach(async () => {
  await resetDb();
  orgId = (await currentOrg()).id;
  admin = await signInAs();
  ({ clientId, projectId } = await seedProject(admin.user.id, 'Gealan'));
  otherProject = (await prisma.project.create({ data: { clientId, name: 'HIDDEN PROJECT', position: 1 } })).id;
  ownCampaign = (await seedCampaign(projectId, 'North', 'META')).id;
  foreignCampaign = (await seedCampaign(projectId, 'HIDDEN CAMPAIGN', 'META')).id;
  for (const [campaignId, spend] of [[ownCampaign, '1000'], [foreignCampaign, '4000']]) {
    await prisma.campaignDailyMetric.create({ data: { campaignId, date: new Date('2026-11-05'), spend, impressions: 100, clicks: 10 } });
  }
  foreignAdSet = (await prisma.adSet.create({data:{campaignId:foreignCampaign,name:'HIDDEN AD SET',position:0}})).id;
  foreignAd = (await prisma.ad.create({data:{adSetId:foreignAdSet,name:'HIDDEN AD',position:0,externalId:'hidden-ad'}})).id;
  foreignCreative = (await prisma.adCreative.create({data:{adId:foreignAd,externalId:'hidden-creative',position:0,kind:'IMAGE',fileKey:'hidden-file',contentType:'image/png'}})).id;
  dealer = await signInAs('Dealer', { role: 'PARTNER' });
  await prisma.membership.update({ where: { id: dealer.membership!.id }, data: { campaignId: ownCampaign } });
  ownCompany = (await prisma.company.create({ data: { orgId, clientId, name: 'North company' } })).id;
  foreignCompany = (await prisma.company.create({ data: { orgId, clientId, name: 'HIDDEN COMPANY' } })).id;
  ownPerson = (await prisma.person.create({ data: { orgId, clientId, name: 'North contact', companyId: ownCompany } })).id;
  foreignPerson = (await prisma.person.create({ data: { orgId, clientId, name: 'HIDDEN PERSON', companyId: foreignCompany } })).id;
  ownLead = (await prisma.lead.create({ data: { orgId, projectId, name: 'North lead', campaignId: ownCampaign, personId: ownPerson, companyId: ownCompany, stage: 'NEW', position: 0 } })).id;
  foreignLead = (await prisma.lead.create({ data: { orgId, projectId, name: 'HIDDEN LEAD', campaignId: foreignCampaign, personId: foreignPerson, companyId: foreignCompany, stage: 'NEW', position: 1 } })).id;
});
afterAll(() => prisma.$disconnect());

describe('partner reach', () => {
  it('resolves the actor with its campaign and refuses an unbound partner membership', async () => {
    const directory = new PrismaMembershipDirectory(prisma);
    const membership = await directory.findActiveByUserId(dealer.user.id);
    expect(membership?.actor.partner).toEqual({ campaignId: ownCampaign, projectId });
    await prisma.membership.update({ where: { id: dealer.membership!.id }, data: { campaignId: null } });
    expect(await directory.findActiveByUserId(dealer.user.id)).toBeNull();
    expect((await read('/api/projects')).status).toBe(403);
  });

  it('describes only projects and CRM in the session, without tariff usage', async () => {
    const session = await read('/api/auth/me').expect(200);
    expect(session.body).toMatchObject({ role: 'PARTNER', partner: { campaignId: ownCampaign, projectId }, modules: ['PROJECTS', 'CRM'], tariff: null });
    await prisma.organization.update({ where: { id: orgId }, data: { tariff: 'SOLO' } });
    expect((await read('/api/auth/me')).body.modules).toEqual(['PROJECTS']);
    await read(`${board()}/leads`).expect(404);
  });

  it('counts figures over its campaign and keeps agency and client figures unchanged', async () => {
    expect((await read('/api/projects')).body.map((p: {id:string}) => p.id)).toEqual([projectId]);
    expect((await read(`/api/projects/${projectId}/campaigns?${range}`)).body.map((c: {id:string}) => c.id)).toEqual([ownCampaign]);
    expect((await read(`/api/projects/${projectId}/summary?${range}`)).body.spend).toBe(1000);
    const client = await signInAs('Client', { role: 'CLIENT' });
    await grantAccess(client.membership!.id, clientId);
    for (const as of [admin, client]) expect((await read(`/api/projects/${projectId}/summary?${range}`, as)).body.spend).toBe(5000);
  });

  it('narrows the board, stage counts, contacts, companies and their related leads', async () => {
    expect((await read(`${board()}/leads`)).body.map((l: {id:string}) => l.id)).toEqual([ownLead]);
    expect((await read(`/api/crm/project-stage-counts?${range}`)).body).toEqual([{ projectId, NEW: 1, QUALIFIED: 0, TARGET: 0, PROPOSAL: 0 }]);
    const counts = await read(`${board()}/stage-counts?${range}`);
    expect(counts.body.campaigns.map((c: {campaignId:string}) => c.campaignId)).toEqual([ownCampaign]);
    for (const [kind, id] of [['people', ownPerson], ['companies', ownCompany]]) {
      const list = await read(`/api/crm/clients/${clientId}/${kind}`).expect(200);
      expect(list.body.map((r: {id:string}) => r.id)).toEqual([id]);
      const detail = await read(`/api/crm/clients/${clientId}/${kind}/${id}`).expect(200);
      expect(detail.body.leads.map((l: {id:string}) => l.id)).toEqual([ownLead]);
    }
  });

  it('answers not found for another project, campaign, lead, notes, files and contact', async () => {
    for (const path of [
      `/api/projects/${otherProject}`, `/api/projects/${otherProject}/summary?${range}`, `/api/campaigns/${foreignCampaign}?${range}`,
      `/api/ad-sets/${foreignAdSet}/ads?${range}`, `/api/ads/${foreignAd}/preview`, `/api/ads/${foreignAd}/creatives`, `/api/ad-creatives/${foreignCreative}/file`,
      `${board()}/leads/${foreignLead}`, ...['notes', 'files', 'activity'].map(part => `${board()}/leads/${foreignLead}/${part}`),
      `/api/crm/clients/${clientId}/people/${foreignPerson}`, `/api/crm/clients/${clientId}/companies/${foreignCompany}`,
    ]) await read(path).expect(404);
  });

  it('keeps its leads on its campaign, assigns within the campaign, and refuses deletion and board changes', async () => {
    const create = (body: object) => request(app).post(`${board()}/leads`).set(dealer.auth).send({ name: 'Phone lead', ...body });
    await create({ campaignId: foreignCampaign }).expect(403);
    await create({ assigneeId: admin.membership!.id }).expect(400);
    const created = await create({ assigneeId: dealer.membership!.id, contact: { phone: '+375123' } }).expect(201);
    expect(created.body.campaignId).toBe(ownCampaign);
    expect((await create({ campaignId: ownCampaign })).body.campaignId).toBe(ownCampaign);
    await request(app).patch(`${board()}/leads/${ownLead}`).set(dealer.auth).send({ campaignId: foreignCampaign }).expect(403);
    expect((await request(app).patch(`${board()}/leads/${ownLead}`).set(dealer.auth).send({ campaignId: null }).expect(200)).body.campaignId).toBe(ownCampaign);
    await request(app).patch(`${board()}/leads/${ownLead}`).set(dealer.auth).send({ personId: foreignPerson, contact: { phone: 'hacked' } }).expect(404);
    await request(app).patch(`${board()}/leads/${ownLead}/move`).set(dealer.auth).send({ stage: 'QUALIFIED', position: 0 }).expect(200);
    await request(app).delete(`${board()}/leads/${ownLead}`).set(dealer.auth).expect(403);
    await request(app).post(`${board()}/columns`).set(dealer.auth).send({ name: 'Column' }).expect(403);
    await request(app).post(`${board()}/fields`).set(dealer.auth).send({ name: 'Field', type: 'TEXT' }).expect(403);
    expect((await read(`${board()}/assignees`)).body.map((m: {id:string}) => m.id)).toEqual([dealer.membership!.id]);
  });

  it('shows and edits its contacts and lead notes without deleting contacts or exposing notifications of other leads', async () => {
    await request(app).patch(`/api/crm/clients/${clientId}/people/${ownPerson}`).set(dealer.auth).send({ phone: '+123' }).expect(200);
    await request(app).delete(`/api/crm/clients/${clientId}/people/${ownPerson}`).set(dealer.auth).expect(403);
    await request(app).post(`/api/crm/clients/${clientId}/people`).set(dealer.auth).send({name:'Unlinked contact'}).expect(403);
    await request(app).post(`/api/crm/clients/${clientId}/companies`).set(dealer.auth).send({name:'Unlinked company'}).expect(403);
    await request(app).post(`${board()}/leads/${ownLead}/notes`).set(dealer.auth).send({ body: 'Called' }).expect(201);
    expect((await read(`${board()}/leads/${ownLead}/notes`)).body).toHaveLength(1);
    for (const leadId of [ownLead, foreignLead]) await prisma.notification.create({ data: { recipientId: dealer.membership!.id, kind: 'LEAD_MENTIONED', projectId, leadId } });
    await prisma.notification.create({ data: { recipientId: dealer.membership!.id, kind: 'PROJECT_CREATED', projectId } });
    const notifications = await read('/api/notifications').expect(200);
    expect(notifications.body.notifications.map((n: {lead:{id:string}}) => n.lead.id)).toEqual([ownLead]);
  });

  it('calls every GET route the API serves and returns no data outside the partner scope', async () => {
    interface Layer { handle?: { stack?: Layer[] }; route?: { path: string; methods: Record<string, boolean> } }
    const stack = (createRoutes(createContainer()) as unknown as {stack:Layer[]}).stack;
    const patterns = [...new Set(stack.flatMap((layer, index) => {
      const mount = ROUTE_MOUNTS[index];
      if (['docs', 'shared', 'google-callback'].includes(mount.id)) return [];
      return (layer.handle?.stack ?? []).flatMap(inner => inner.route?.methods.get ? [`${mount.path}/${inner.route.path}`.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1')] : []);
    }))];
    expect(patterns.length).toBeGreaterThan(80);
    const safe = /^(\/api\/telegram|\/api\/support\/contacts|\/api\/auth\/me|\/api\/user\/profile|\/api\/notifications(?:\/unread-count)?|\/api\/projects(?:\/[^/]+(?:\/avatar|\/summary|\/daily|\/campaigns(?:\/names)?|\/summary-tiles)?)?|\/api\/campaigns\/[^/]+(?:\/daily|\/ad-sets)?|\/api\/ad-sets\/[^/]+\/ads|\/api\/ad-creatives\/[^/]+\/(?:file|poster)|\/api\/ads\/[^/]+\/(?:preview|creatives)|\/api\/summary(?:\/projects|\/daily|\/channels)?|\/api\/crm(?:\/.*)?)$/;
    for (const pattern of patterns) {
      const path = pattern.replace(/:projectId|:boardKey/g, projectId).replace(/:clientId/g, clientId)
        .replace(/:id/g, pattern.includes('/campaigns') ? ownCampaign : pattern.includes('/people') ? ownPerson : pattern.includes('/companies') ? ownCompany : pattern.includes('/leads') ? ownLead : projectId)
        .replace(/:[A-Za-z]+/g, projectId);
      if (path === '/api/notifications/stream') {
        await new Promise<void>((resolve, reject) => {
          const pending = read(path).buffer(false).parse((res, callback) => { res.destroy(); callback(null, {}); });
          pending.end((error, response) => response?.status === 200 || error?.code === 'ECONNRESET' ? resolve() : reject(error));
        });
        continue;
      }
      const query = path.startsWith('/api/audit') ? '' : path.endsWith('/accounts') ? `authorization=${projectId}` : path.endsWith('/top') ? `${range}&kind=query` : range;
      const response = await read(`${path}?${query}`);
      expect(response.status, pattern).toBeLessThan(500);
      expect(JSON.stringify(response.body), pattern).not.toMatch(/HIDDEN/);
      if (!safe.test(path)) expect.soft([403, 404], pattern).toContain(response.status);
    }
  });
});

it('does not expose an unlinked company through a contact read or update', async () => {
  await prisma.person.update({where:{id:ownPerson},data:{companyId:foreignCompany}});
  const path = `/api/crm/clients/${clientId}/people/${ownPerson}`;
  const before = await read(path).expect(200);
  expect(before.body.company).toBeNull();
  expect(before.body.companyId).toBeNull();
  const after = await request(app).patch(path).set(dealer.auth).send({phone:'+123'}).expect(200);
  expect(after.body.company).toBeNull();
  expect(JSON.stringify(after.body)).not.toContain('HIDDEN');
});

it('includes a Meta lead as soon as it lands for the partner campaign, and loses access on removal', async () => {
  const imported = await prisma.lead.create({data:{orgId,projectId,campaignId:ownCampaign,name:'Meta enquiry',origin:'META',stage:'NEW',position:2}});
  expect((await read(`${board()}/leads`)).body.map((l:{id:string})=>l.id)).toContain(imported.id);
  await request(app).delete(`/api/members/${dealer.membership!.id}`).set(admin.auth).expect(204);
  await read(`${board()}/leads`).expect(403);
});

it('loses access when its campaign is deleted', async () => {
  await prisma.campaign.delete({where:{id:ownCampaign}});
  await read('/api/projects').expect(403);
});


it('does not widen partner reach through an ordinary client grant', async () => {
  await grantAccess(dealer.membership!.id, clientId);
  await read(`/api/clients/${clientId}`).expect(404);
  await read(`/api/projects/${otherProject}`).expect(404);
  expect((await read('/api/projects')).body.map((p:{id:string})=>p.id)).toEqual([projectId]);
});
