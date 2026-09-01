import { randomUUID } from "node:crypto";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { RandomIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { PrismaCampaignRepository } from "../../src/modules/campaigns/infrastructure/prisma-campaign-repositories.js";
import { currentOrg } from "./auth.js";

/** Wipes everything a test may have created. The organization is deliberately
 * left standing: the tenancy migration creates exactly one per database, and
 * `client.org_id` is NOT NULL, so a test with no organization could not store a
 * client at all. Memberships go with their users by cascade; deleting them
 * explicitly keeps this list readable as the full inventory. */
export async function resetDb(): Promise<void> {
  await prisma.auditEvent.deleteMany();
  await prisma.clientAccess.deleteMany();
  await prisma.campaignPropertyValue.deleteMany();
  await prisma.campaignRecord.deleteMany();
  await prisma.campaignProperty.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  // Before memberships and users: an invitation outlives both by design
  // (SET NULL), so it would otherwise survive the wipe and collide with the
  // next test's fixed codes.
  await prisma.invite.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  // The migration's organization stays; any a test made for the tenancy
  // boundary goes, so the next test still finds exactly one.
  const original = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  await prisma.organization.deleteMany({ where: { id: { not: original.id } } });
}

/** A client with one project under it — the shape almost every test needs now
 * that sheets hang off a project rather than off the company. */
export async function seedProject(
  _unusedOwnerId: string,
  name = "Acme",
): Promise<{ clientId: string; projectId: string }> {
  const client = await prisma.client.create({
    data: { name, orgId: (await currentOrg()).id },
  });
  const project = await prisma.project.create({
    data: { clientId: client.id, name, position: 0 },
  });
  return { clientId: client.id, projectId: project.id };
}

/** A campaign with the default column set, seeded the way production seeds it. */
export async function seedCampaign(projectId: string, name = "A") {
  const unitOfWork = new PrismaUnitOfWork(prisma);
  const repository = new PrismaCampaignRepository(prisma, unitOfWork, new RandomIdGenerator());
  const position = await prisma.campaign.count({ where: { projectId } });
  return unitOfWork.run((context) =>
    repository.create(context, { id: randomUUID(), projectId, name, position }),
  );
}
