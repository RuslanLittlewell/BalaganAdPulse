import { prisma } from "../../src/lib/prisma.js";

export async function resetDb(): Promise<void> {
  await prisma.campaignPropertyValue.deleteMany();
  await prisma.campaignRecord.deleteMany();
  await prisma.campaignProperty.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

/** A client with one project under it — the shape almost every test needs now
 * that sheets hang off a project rather than off the company. */
export async function seedProject(
  ownerId: string,
  name = "Acme",
): Promise<{ clientId: string; projectId: string }> {
  const client = await prisma.client.create({ data: { name, ownerId } });
  const project = await prisma.project.create({
    data: { clientId: client.id, name, position: 0 },
  });
  return { clientId: client.id, projectId: project.id };
}
