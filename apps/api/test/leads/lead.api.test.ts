import { afterAll, beforeEach, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/composition/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma.js';
import { resetDb, seedProject } from '../helpers/db.js';
import { signInAs, signInAsOutsider, grantAccess } from '../helpers/auth.js';
const app = createApp();
let auth: {Authorization:string};
let clientId: string;
beforeEach(async () => { await resetDb(); const a = await signInAs(); auth=a.auth; clientId=(await seedProject(a.user.id)).clientId; });
afterAll(() => prisma.$disconnect());
const url = (board='agency') => `/api/crm/boards/${board}/leads`;
const create = (name='Lead', board='agency') => request(app).post(url(board)).set(auth).send({name});
it('lists empty reachable boards and defaults new leads', async () => {
  expect((await request(app).get('/api/crm/boards').set(auth)).body.map((b:{key:string})=>b.key)).toEqual(['agency',clientId]);
  expect((await request(app).get(url()).set(auth)).body).toEqual([]);
  const r=await create(); expect(r.status).toBe(201); expect(r.body).toMatchObject({name:'Lead',stage:'NEW',position:0,clientId:null});
});
it('round trips contacts and isolates boards', async () => {
  const a=await create(); const fields={company:'Company',phone:'+48123456789',email:'lead@example.com',website:'https://example.com',source:'Referral',notes:'Needs a demo'};
  expect((await request(app).patch(`${url()}/${a.body.id}`).set(auth).send(fields)).body).toMatchObject(fields);
  expect((await request(app).get(`${url()}/${a.body.id}`).set(auth)).body).toMatchObject(fields);
  expect((await request(app).get(url(clientId)).set(auth)).body).toEqual([]);
  expect((await request(app).get(`${url(clientId)}/${a.body.id}`).set(auth)).status).toBe(404);
  expect((await request(app).patch(`${url()}/${a.body.id}`).set(auth).send({clientId})).status).toBe(400);
});
it.each([{name:' '},{name:'x'.repeat(201)},{email:'bad'},{website:'javascript:alert(1)'},{phone:'x'.repeat(51)},{source:'x'.repeat(201)},{notes:'x'.repeat(10001)},{stage:'BAD'}])('rejects invalid fields %j', async fields => {
  expect((await request(app).post(url()).set(auth).send({name:'Valid',...fields})).status).toBe(400);
  expect(await prisma.lead.count()).toBe(0);
});
it.each(['CLIENT','CLIENT_ADMIN'] as const)('allows %s to manage only their own funnel', async role => {
  const customer=await signInAs('Customer',{role}); await grantAccess(customer.membership!.id,clientId);
  const r=await request(app).post(url(clientId)).set(customer.auth).send({name:'Buyer'}); expect(r.status).toBe(201);
  expect((await request(app).patch(`${url(clientId)}/${r.body.id}`).set(customer.auth).send({source:'Ads'})).status).toBe(200);
  expect((await request(app).patch(`${url(clientId)}/${r.body.id}/move`).set(customer.auth).send({stage:'WON',position:0})).status).toBe(200);
  expect((await request(app).get(url()).set(customer.auth)).status).toBe(404);
  expect((await request(app).delete(`${url(clientId)}/${r.body.id}`).set(customer.auth)).status).toBe(204);
});
it('rejects guests, suspended users and outsiders', async () => {
  const guest=await signInAs('Guest',{role:'GUEST'});
  expect((await request(app).post(url()).set(guest.auth).send({name:'X'})).status).toBe(403);
  const suspended=await signInAs('Suspended',{status:'SUSPENDED'});
  expect((await request(app).get(url()).set(suspended.auth)).status).toBe(403);
  const outsider=await signInAsOutsider();
  expect((await request(app).get(url(clientId)).set(outsider.auth)).status).toBe(404);
  expect((await request(app).get(url())).status).toBe(401);
});
it('serializes moves and keeps WON status-only', async () => {
  const a=(await create('A')).body,b=(await create('B')).body,c=(await create('C')).body;
  await Promise.all([a,b,c].map(l=>request(app).patch(`${url()}/${l.id}/move`).set(auth).send({stage:'WON',position:0}).expect(200)));
  const leads=(await request(app).get(url()).set(auth)).body;
  expect(leads.map((l:{position:number})=>l.position)).toEqual([0,1,2]);
  expect(await prisma.client.count()).toBe(1); expect(await prisma.project.count()).toBe(1); expect(await prisma.user.count()).toBe(1);
  await request(app).patch(`${url()}/${a.id}/move`).set(auth).send({stage:'NEGOTIATION',position:999}).expect(200);
  await request(app).patch(`${url()}/${a.id}/move`).set(auth).send({stage:'NEW',position:-1}).expect(400);
  await request(app).delete(`${url()}/${b.id}`).set(auth).expect(204);
  expect((await prisma.lead.findMany({where:{stage:'WON'}})).map(l=>l.position)).toEqual([0]);
  expect(await prisma.auditEvent.count({where:{entityType:'lead'}})).toBe(8);
});
it('hides lead audits from project-only grants and other customers', async () => {
  await create('Private agency'); await create('Private client',clientId);
  const manager=await signInAs('Manager',{role:'MANAGER'});
  const project=await prisma.project.findFirstOrThrow({where:{clientId}}); await grantAccess(manager.membership!.id,clientId,project.id);
  const r=await request(app).get('/api/audit?entityType=lead').set(manager.auth);
  expect(r.body.items).toHaveLength(1); expect(r.body.items[0].clientId).toBeNull();
});
it('documents every CRM operation', async () => {
  const doc=(await request(app).get('/api/openapi.json')).body;
  expect(doc.paths['/api/crm/boards']).toHaveProperty('get');
  expect(doc.paths['/api/crm/boards/{boardKey}/leads/{id}/move']).toHaveProperty('patch');
});
