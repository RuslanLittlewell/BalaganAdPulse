import { afterAll, beforeEach, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/composition/app.js';
import { prisma } from '../../src/shared/infrastructure/prisma.js';
import { resetDb, seedProject } from '../helpers/db.js';
import { signInAs, signInAsOutsider, grantAccess } from '../helpers/auth.js';
const app = createApp();
let auth: {Authorization:string};
let clientId: string;
let projectId: string;
beforeEach(async () => { await resetDb(); const a = await signInAs(); auth=a.auth; ({clientId,projectId}=await seedProject(a.user.id)); });
afterAll(() => prisma.$disconnect());
const url = (board=projectId) => `/api/crm/boards/${board}/leads`;
const create = (name='Lead', board=projectId) => request(app).post(url(board)).set(auth).send({name});
const secondProject = (name='Второй', client=clientId) => prisma.project.create({data:{clientId:client,name,position:1}});
it('lists one board per project and defaults new leads onto it', async () => {
  expect((await request(app).get('/api/crm/boards').set(auth)).body.map((b:{key:string})=>b.key)).toEqual([projectId]);
  expect((await request(app).get(url()).set(auth)).body).toEqual([]);
  const r=await create(); expect(r.status).toBe(201); expect(r.body).toMatchObject({name:'Lead',stage:'NEW',position:0,projectId,project:{id:projectId,clientId}});
});
it('offers no agency board', async () => {
  expect((await request(app).get('/api/crm/boards').set(auth)).body.map((b:{key:string})=>b.key)).not.toContain('agency');
  expect((await request(app).get(url('agency')).set(auth)).status).toBe(404);
  expect((await request(app).post(url('agency')).set(auth).send({name:'X'})).status).toBe(404);
  expect(await prisma.lead.count()).toBe(0);
});
it('places each new lead first in its stage, pushing earlier leads back', async () => {
  const a=(await create('A')).body,b=(await create('B')).body,c=(await create('C')).body;
  const leads=(await request(app).get(url()).set(auth)).body;
  expect(leads.map((l:{id:string;position:number})=>[l.id,l.position])).toEqual([
    [c.id,0],[b.id,1],[a.id,2],
  ]);
});
it('names each board by its project, beside its client, ordered by client then project', async () => {
  await prisma.client.update({where:{id:clientId},data:{name:'Ромашка',organization:'ООО «Цветы»'}});
  await prisma.project.update({where:{id:projectId},data:{name:'Сайт'}});
  const second=await secondProject('Реклама');
  const other=await seedProject('unused','Астра');
  await prisma.project.update({where:{id:other.projectId},data:{name:'Астра проект'}});
  const boards=(await request(app).get('/api/crm/boards').set(auth)).body;
  expect(boards.map((b:{key:string;label:string;clientName:string})=>[b.key,b.label,b.clientName])).toEqual([
    [other.projectId,'Астра проект','Астра'],
    [projectId,'Сайт','Ромашка'],
    [second.id,'Реклама','Ромашка'],
  ]);
});
it('round trips contacts and isolates the boards of one client', async () => {
  const second=await secondProject();
  const a=await create(); const fields={company:'Company',phone:'+48123456789',email:'lead@example.com',website:'https://example.com',source:'Referral',notes:'Needs a demo'};
  expect((await request(app).patch(`${url()}/${a.body.id}`).set(auth).send(fields)).body).toMatchObject(fields);
  expect((await request(app).get(`${url()}/${a.body.id}`).set(auth)).body).toMatchObject(fields);
  expect((await request(app).get(url(second.id)).set(auth)).body).toEqual([]);
  expect((await request(app).get(`${url(second.id)}/${a.body.id}`).set(auth)).status).toBe(404);
});
it('refuses a request that names a project', async () => {
  const second=await secondProject();
  expect((await request(app).post(url()).set(auth).send({name:'X',projectId:second.id})).status).toBe(400);
  const a=(await create()).body;
  expect((await request(app).patch(`${url()}/${a.id}`).set(auth).send({projectId:second.id})).status).toBe(400);
  expect((await prisma.lead.findUniqueOrThrow({where:{id:a.id}})).projectId).toBe(projectId);
  expect(await prisma.lead.count()).toBe(1);
});
it('assigns a member who reaches the project and returns project and assignee details', async () => {
  const teammate=await signInAs('Мария',{role:'MANAGER'});
  await grantAccess(teammate.membership!.id,clientId,projectId);
  const response=await request(app).post(url()).set(auth).send({name:'Assigned',assigneeId:teammate.membership!.id});
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    project:{id:projectId,clientId},
    assignee:{id:teammate.membership!.id,name:'Мария'},
    assigneeId:teammate.membership!.id,
  });
});
it('rejects an assignee who does not reach the board project', async () => {
  const second=await secondProject();
  const teammate=await signInAs('Другой проект',{role:'MANAGER'});
  await grantAccess(teammate.membership!.id,clientId,second.id);
  const response=await request(app).post(url()).set(auth).send({name:'Assigned',assigneeId:teammate.membership!.id});
  expect(response.status).toBe(400);
  expect(await prisma.lead.count()).toBe(0);
});
it.each([{name:' '},{name:'x'.repeat(201)},{email:'bad'},{website:'javascript:alert(1)'},{phone:'x'.repeat(51)},{source:'x'.repeat(201)},{notes:'x'.repeat(10001)},{stage:'BAD'}])('rejects invalid fields %j', async fields => {
  expect((await request(app).post(url()).set(auth).send({name:'Valid',...fields})).status).toBe(400);
  expect(await prisma.lead.count()).toBe(0);
});
it.each(['CLIENT','CLIENT_ADMIN'] as const)('allows %s to manage the funnels of their own projects only', async role => {
  const second=await secondProject();
  const other=await seedProject('unused','Чужой');
  const customer=await signInAs('Customer',{role}); await grantAccess(customer.membership!.id,clientId);
  expect((await request(app).get('/api/crm/boards').set(customer.auth)).body.map((b:{key:string})=>b.key)).toEqual([projectId,second.id]);
  const r=await request(app).post(url()).set(customer.auth).send({name:'Buyer'}); expect(r.status).toBe(201);
  expect((await request(app).patch(`${url()}/${r.body.id}`).set(customer.auth).send({source:'Ads'})).status).toBe(200);
  expect((await request(app).patch(`${url()}/${r.body.id}/move`).set(customer.auth).send({stage:'PROPOSAL',position:0})).status).toBe(200);
  expect((await request(app).get(url(other.projectId)).set(customer.auth)).status).toBe(404);
  expect((await request(app).delete(`${url()}/${r.body.id}`).set(customer.auth)).status).toBe(204);
});
it('lets a project-only grant reach that project board alone', async () => {
  const second=await secondProject();
  const manager=await signInAs('Manager',{role:'MANAGER'});
  await grantAccess(manager.membership!.id,clientId,projectId);
  expect((await request(app).get('/api/crm/boards').set(manager.auth)).body.map((b:{key:string})=>b.key)).toEqual([projectId]);
  expect((await request(app).get(url()).set(manager.auth)).status).toBe(200);
  expect((await request(app).get(url(second.id)).set(manager.auth)).status).toBe(404);
});
it('lets a whole-client grant reach every project board of the client', async () => {
  const second=await secondProject();
  const manager=await signInAs('Manager',{role:'MANAGER'});
  await grantAccess(manager.membership!.id,clientId);
  expect((await request(app).get('/api/crm/boards').set(manager.auth)).body.map((b:{key:string})=>b.key)).toEqual([projectId,second.id]);
});
it('rejects guests, suspended users and outsiders', async () => {
  const guest=await signInAs('Guest',{role:'GUEST'}); await grantAccess(guest.membership!.id,clientId);
  expect((await request(app).post(url()).set(guest.auth).send({name:'X'})).status).toBe(403);
  const suspended=await signInAs('Suspended',{status:'SUSPENDED'});
  expect((await request(app).get(url()).set(suspended.auth)).status).toBe(403);
  const outsider=await signInAsOutsider();
  expect((await request(app).get(url()).set(outsider.auth)).status).toBe(404);
  expect((await request(app).get(url())).status).toBe(401);
});
it('serializes moves and keeps PROPOSAL status-only', async () => {
  const a=(await create('A')).body,b=(await create('B')).body,c=(await create('C')).body;
  await Promise.all([a,b,c].map(l=>request(app).patch(`${url()}/${l.id}/move`).set(auth).send({stage:'PROPOSAL',position:0}).expect(200)));
  const leads=(await request(app).get(url()).set(auth)).body;
  expect(leads.map((l:{position:number})=>l.position)).toEqual([0,1,2]);
  expect(await prisma.client.count()).toBe(1); expect(await prisma.project.count()).toBe(1); expect(await prisma.user.count()).toBe(1);
  await request(app).patch(`${url()}/${a.id}/move`).set(auth).send({stage:'TARGET',position:999}).expect(200);
  await request(app).patch(`${url()}/${a.id}/move`).set(auth).send({stage:'NEW',position:-1}).expect(400);
  await request(app).delete(`${url()}/${b.id}`).set(auth).expect(204);
  expect((await prisma.lead.findMany({where:{stage:'PROPOSAL'}})).map(l=>l.position)).toEqual([0]);
  expect(await prisma.auditEvent.count({where:{entityType:'lead'}})).toBe(8);
});
it('shows lead audits only to members who reach the board project', async () => {
  const second=await secondProject();
  await create('On the first project'); await create('On the second project',second.id);
  const manager=await signInAs('Manager',{role:'MANAGER'});
  await grantAccess(manager.membership!.id,clientId,projectId);
  const r=await request(app).get('/api/audit?entityType=lead').set(manager.auth);
  expect(r.body.items).toHaveLength(1);
  expect(r.body.items[0]).toMatchObject({clientId,projectId});
});
it('removes the funnel with its project and leaves other boards alone', async () => {
  const second=await secondProject();
  await create('Goes'); await create('Stays',second.id);
  await request(app).post(`/api/crm/boards/${projectId}/columns`).set(auth).send({name:'Встреча'}).expect(201);
  await request(app).delete(`/api/projects/${projectId}`).set(auth).expect(204);
  expect((await prisma.lead.findMany()).map(l=>l.name)).toEqual(['Stays']);
  expect(await prisma.leadColumn.count()).toBe(0);
  expect((await request(app).get(url()).set(auth)).status).toBe(404);
});
it('removes every funnel of a deleted client', async () => {
  const second=await secondProject();
  const other=await seedProject('unused','Другой клиент');
  await create('A'); await create('B',second.id); await create('Other',other.projectId);
  await request(app).delete(`/api/clients/${clientId}`).set(auth).expect(204);
  expect((await prisma.lead.findMany()).map(l=>l.name)).toEqual(['Other']);
});
it('keeps a funnel with its project when the project moves to another client', async () => {
  const other=await seedProject('unused','Новый владелец');
  await create('Travels');
  await request(app).patch(`/api/projects/${projectId}`).set(auth).send({clientId:other.clientId}).expect(200);
  const leads=(await request(app).get(url()).set(auth)).body;
  expect(leads).toHaveLength(1);
  expect(leads[0]).toMatchObject({name:'Travels',project:{id:projectId,clientId:other.clientId}});
});
it('documents every CRM operation', async () => {
  const doc=(await request(app).get('/api/openapi.json')).body;
  expect(doc.paths['/api/crm/boards']).toHaveProperty('get');
  expect(doc.paths['/api/crm/boards/{boardKey}/leads/{id}/move']).toHaveProperty('patch');
});
