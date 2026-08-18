import { prisma } from "../../src/lib/prisma.js";

export async function resetDb(): Promise<void> {
  await prisma.campaignPropertyValue.deleteMany();
  await prisma.campaignRecord.deleteMany();
  await prisma.campaignProperty.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}
