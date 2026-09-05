import { afterAll, beforeEach, expect, it } from 'vitest';
import { can, ROLES } from '@adpulse/access-policy';
import { prisma } from '../../src/shared/infrastructure/prisma.js';
import { resetDb, seedProject } from '../helpers/db.js';
import { signInAs, signInAsOutsider, grantAccess } from '../helpers/auth.js';
import { LEAD_STAGES } from '../../src/modules/leads/domain/lead.js';
import { PrismaLeadRepository } from '../../src/modules/leads/infrastructure/prisma-lead-repository.js';
import { PrismaUnitOfWork } from '../../src/shared/infrastructure/prisma-unit-of-work.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());
const repository = new PrismaLeadRepository(prisma, new PrismaUnitOfWork(prisma));

it('defines the eight fixed stages in presentation order', () => {
  expect(LEAD_STAGES).toEqual(['NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST','DEFERRED']);
});
it.each(ROLES)('resolves %s boards and verbs independently of task access', async role => {
  const member = await signInAs(role, {role});
  const {clientId, projectId} = await seedProject(member.user.id);
  const actor = member.actor!;
  expect(await repository.reaches(actor, 'agency')).toBe(!['CLIENT','CLIENT_ADMIN'].includes(role));
  expect(await repository.reaches(actor, clientId)).toBe(role === 'ADMIN');
  await grantAccess(actor.membershipId, clientId, projectId);
  expect(await repository.reaches(actor, clientId)).toBe(role === 'ADMIN');
  await grantAccess(actor.membershipId, clientId);
  expect(await repository.reaches(actor, clientId)).toBe(true);
  for (const action of ['create','update','delete'] as const) expect(can(actor, action, 'lead')).toBe(role !== 'GUEST');
  const outsider = await signInAsOutsider();
  expect(await repository.reaches(actor, outsider.client.id)).toBe(false);
});
it('enforces client organization ownership and preserves populated records', async () => {
  const member = await signInAs();
  const {clientId, projectId} = await seedProject(member.user.id);
  const outsider = await signInAsOutsider();
  await expect(prisma.lead.create({data:{name:'Wrong', orgId:member.actor!.orgId, clientId:outsider.client.id}})).rejects.toThrow();
  const own = await prisma.lead.create({data:{name:'Own', orgId:member.actor!.orgId, clientId}});
  const agency = await prisma.lead.create({data:{name:'Agency', orgId:member.actor!.orgId}});
  expect(await prisma.project.findUnique({where:{id:projectId}})).not.toBeNull();
  await prisma.client.delete({where:{id:clientId}});
  expect(await prisma.lead.findUnique({where:{id:own.id}})).toBeNull();
  expect(await prisma.lead.findUnique({where:{id:agency.id}})).not.toBeNull();
});
