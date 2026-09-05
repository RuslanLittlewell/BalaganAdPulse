import { randomUUID } from "node:crypto";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { RandomIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { currentOrg } from "./auth.js";

export async function resetDb(): Promise<void> {
  await prisma.lead.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.clientAccess.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  const original = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  await prisma.organization.deleteMany({ where: { id: { not: original.id } } });
}

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

export async function seedCampaign(projectId: string, name = "A", channel: "META" | "GOOGLE" | "YANDEX" | "VK" | "TIKTOK" | "LINKEDIN" | "TELEGRAM" = "YANDEX") {
  const position = await prisma.campaign.count({ where: { projectId } });
  return prisma.campaign.create({ data: { projectId, name, channel, position } });
}
