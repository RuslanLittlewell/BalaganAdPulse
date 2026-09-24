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

it('defines the four fixed stages in presentation order', () => {
  expect(LEAD_STAGES).toEqual(['NEW','QUALIFIED','TARGET','PROPOSAL']);
});
it.each(ROLES)('resolves %s project boards and verbs independently of task access', async role => {
  const member = await signInAs(role, {role});
  const {clientId, projectId} = await seedProject(member.user.id);
  const second = await prisma.project.create({data:{clientId, name:'Второй', position:1}});
  const actor = member.actor!;
  expect(await repository.reaches(actor, 'agency')).toBe(false);
  expect(await repository.reaches(actor, projectId)).toBe(role === 'ADMIN');
  await grantAccess(actor.membershipId, clientId, projectId);
  expect(await repository.reaches(actor, projectId)).toBe(true);
  expect(await repository.reaches(actor, second.id)).toBe(role === 'ADMIN');
  await grantAccess(actor.membershipId, clientId);
  expect(await repository.reaches(actor, second.id)).toBe(true);
  for (const action of ['create','update','delete'] as const) expect(can(actor, action, 'lead')).toBe(role !== 'GUEST');
  const outsider = await signInAsOutsider();
  const theirs = await prisma.project.create({data:{clientId:outsider.client.id, name:'Их', position:0}});
  expect(await repository.reaches(actor, theirs.id)).toBe(false);
});
it('requires a project and removes leads and columns with it', async () => {
  const member = await signInAs();
  const {clientId, projectId} = await seedProject(member.user.id);
  const orgId = member.actor!.orgId;
  await expect(prisma.$executeRaw`INSERT INTO lead (id, org_id, name, updated_at) VALUES (gen_random_uuid(), ${orgId}, 'Orphan', now())`).rejects.toThrow();
  const kept = await seedProject(member.user.id, 'Kept');
  const own = await prisma.lead.create({data:{name:'Own', orgId, projectId}});
  const other = await prisma.lead.create({data:{name:'Other', orgId, projectId:kept.projectId}});
  await prisma.leadColumn.create({data:{orgId, projectId, name:'Встреча'}});
  await prisma.project.delete({where:{id:projectId}});
  expect(await prisma.lead.findUnique({where:{id:own.id}})).toBeNull();
  expect(await prisma.leadColumn.count()).toBe(0);
  expect(await prisma.lead.findUnique({where:{id:other.id}})).not.toBeNull();
  await prisma.client.delete({where:{id:kept.clientId}});
  expect(await prisma.lead.count()).toBe(0);
  expect(await prisma.client.findUnique({where:{id:clientId}})).not.toBeNull();
});
