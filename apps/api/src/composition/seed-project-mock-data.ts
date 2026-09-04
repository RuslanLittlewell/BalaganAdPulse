import "dotenv/config";
import { PrismaClient, type Channel } from "@prisma/client";

const prisma = new PrismaClient();

const campaigns: Array<{
  name: string;
  channel: Channel;
  objective: string;
  spendFactor: number;
  conversionFactor: number;
  resultFactor: number;
}> = [
  { name: "Meta — Lead Generation", channel: "META", objective: "LEADS", spendFactor: 1.2, conversionFactor: 1.15, resultFactor: 0.62 },
  { name: "Google — Brand Search", channel: "GOOGLE", objective: "TRAFFIC", spendFactor: 0.85, conversionFactor: 1.35, resultFactor: 1.04 },
  { name: "Yandex — Search", channel: "YANDEX", objective: "CONVERSIONS", spendFactor: 0.95, conversionFactor: 1.1, resultFactor: 2.35 },
  { name: "VK — Retargeting", channel: "VK", objective: "CONVERSIONS", spendFactor: 0.65, conversionFactor: 0.9, resultFactor: 0.78 },
  { name: "TikTok — Awareness", channel: "TIKTOK", objective: "REACH", spendFactor: 1.05, conversionFactor: 0.7, resultFactor: 1.12 },
  { name: "Telegram — Native Ads", channel: "TELEGRAM", objective: "TRAFFIC", spendFactor: 0.55, conversionFactor: 0.8, resultFactor: 1.85 },
];

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export async function seedProjectMockData(projectId: string): Promise<{
  campaigns: number;
  metricRows: number;
  from: string;
  to: string;
}> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new Error(`Project ${projectId} was not found`);

  const from = utcDate(2026, 8, 1);
  const to = utcDate(2026, 8, 31);
  let metricRows = 0;

  await prisma.$transaction(async (tx) => {
    for (const [campaignIndex, definition] of campaigns.entries()) {
      const externalId = `mock-${projectId}-${campaignIndex + 1}`;
      const campaign = await tx.campaign.upsert({
        where: { channel_externalId: { channel: definition.channel, externalId } },
        create: {
          projectId,
          name: definition.name,
          channel: definition.channel,
          objective: definition.objective,
          externalId,
          position: campaignIndex,
          status: campaignIndex === 4 ? "LEARNING" : "ACTIVE",
        },
        update: {
          projectId,
          name: definition.name,
          objective: definition.objective,
          position: campaignIndex,
        },
      });

      for (let day = 1; day <= 31; day += 1) {
        const weekdayFactor = [0.72, 0.82, 1, 1.08, 1.14, 1.2, 0.88][day % 7];
        const trend = 1 + day * 0.012;
        const spend = 82 * definition.spendFactor * weekdayFactor * trend;
        const impressions = Math.round(spend * (118 + campaignIndex * 9));
        const reach = Math.round(impressions * (0.68 + campaignIndex * 0.015));
        const clicks = Math.round(impressions * (0.012 + campaignIndex * 0.0018));
        const conversions = Math.max(1, Math.round(clicks * 0.055 * definition.conversionFactor));
        const revenue = spend * definition.resultFactor;
        const date = utcDate(2026, 8, day);

        await tx.campaignDailyMetric.upsert({
          where: { campaignId_date: { campaignId: campaign.id, date } },
          create: {
            campaignId: campaign.id,
            date,
            spend: spend.toFixed(4),
            impressions,
            reach,
            clicks,
            conversions,
            revenue: revenue.toFixed(4),
          },
          update: {
            spend: spend.toFixed(4),
            impressions,
            reach,
            clicks,
            conversions,
            revenue: revenue.toFixed(4),
            syncedAt: new Date(),
          },
        });
        metricRows += 1;
      }
    }
  });

  return {
    campaigns: campaigns.length,
    metricRows,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const projectId = process.argv[2];
if (!projectId) {
  console.error("Usage: tsx src/composition/seed-project-mock-data.ts <project-id>");
  process.exitCode = 1;
} else {
  seedProjectMockData(projectId)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
