import type { Prisma, PrismaClient } from "@prisma/client";
import { isCustomer } from "@adpulse/access-policy";
import { performanceOf } from "#modules/campaigns/index.js";
import { isKpiMetric, MANUAL_KPI, type IsoDateRange, type KpiFigures, type KpiInput } from "#modules/kpi/index.js";
import type {
  KpiMonthClaims,
  NotificationRecipients,
  NotificationRepository,
  ProjectKpiStandings,
} from "../application/ports.js";
import type { AddressedNotification, NewNotification, NotificationView } from "../domain/notification.js";

const shown = {
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true, projectId: true } },
  actor: { select: { user: { select: { name: true } } } },
} satisfies Prisma.NotificationInclude;

type StoredNotification = Prisma.NotificationGetPayload<{ include: typeof shown }>;

const viewOf = (row: StoredNotification): NotificationView => ({
  id: row.id,
  kind: row.kind,
  createdAt: row.createdAt,
  readAt: row.readAt,
  project: row.project,
  task: row.task,
  actor: row.actor ? { name: row.actor.user.name } : null,
});

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(notifications: readonly NewNotification[]): Promise<AddressedNotification[]> {
    const rows = await this.prisma.$transaction(notifications.map((data) =>
      this.prisma.notification.create({ data, include: shown })));
    return rows.map((row) => ({ ...viewOf(row), recipientId: row.recipientId }));
  }

  async latest(recipientId: string, limit: number): Promise<NotificationView[]> {
    const rows = await this.prisma.notification.findMany({
      where: { recipientId },
      include: shown,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return rows.map(viewOf);
  }

  unreadCount(recipientId: string): Promise<number> {
    return this.prisma.notification.count({ where: { recipientId, readAt: null } });
  }

  async markRead(recipientId: string, id: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, recipientId, readAt: null }, data: { readAt: at },
    });
    if (count > 0) return true;
    return (await this.prisma.notification.count({ where: { id, recipientId } })) > 0;
  }

  async markAllRead(recipientId: string, at: Date): Promise<void> {
    await this.prisma.notification.updateMany({ where: { recipientId, readAt: null }, data: { readAt: at } });
  }
}

export class PrismaNotificationRecipients implements NotificationRecipients {
  constructor(private readonly prisma: PrismaClient) {}

  async staffReaching(projectId: string): Promise<string[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }, select: { clientId: true, client: { select: { orgId: true } } },
    });
    if (!project) return [];
    const members = await this.prisma.membership.findMany({
      where: {
        orgId: project.client.orgId,
        status: "ACTIVE",
        OR: [
          { role: "ADMIN" },
          {
            role: { in: ["MANAGER", "GUEST"] },
            access: { some: { OR: [{ clientId: project.clientId, projectId: null }, { projectId }] } },
          },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return members.map(({ id }) => id);
  }

  async activeMembers(ids: readonly string[]): Promise<Array<{ id: string; customer: boolean }>> {
    const members = await this.prisma.membership.findMany({
      where: { id: { in: [...ids] }, status: "ACTIVE" }, select: { id: true, role: true },
    });
    return members.map(({ id, role }) => ({ id, customer: isCustomer(role) }));
  }
}

const decimal = (value: Prisma.Decimal | null) => value?.toNumber() ?? 0;

export class PrismaProjectKpiStandings implements ProjectKpiStandings {
  constructor(private readonly prisma: PrismaClient) {}

  async read(projectId: string, range: IsoDateRange): Promise<{ kpi: KpiInput; figures: KpiFigures } | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId }, select: { kpiMetric: true, kpiTarget: true, kpiName: true, kpiValue: true },
    });
    const kpi = project && kpiOf(project);
    if (!kpi) return null;
    const sums = await this.prisma.campaignDailyMetric.aggregate({
      where: {
        campaign: { projectId },
        date: { gte: new Date(`${range.from}T00:00:00Z`), lte: new Date(`${range.to}T00:00:00Z`) },
      },
      _sum: { spend: true, impressions: true, reach: true, clicks: true, conversions: true, results: true, revenue: true },
    });
    const figures = performanceOf([{
      spend: decimal(sums._sum.spend),
      impressions: sums._sum.impressions ?? 0,
      reach: sums._sum.reach ?? 0,
      clicks: sums._sum.clicks ?? 0,
      conversions: sums._sum.conversions ?? 0,
      results: sums._sum.results ?? 0,
      revenue: decimal(sums._sum.revenue),
    }]);
    return { kpi, figures };
  }
}

function kpiOf(project: {
  kpiMetric: string | null;
  kpiTarget: Prisma.Decimal | null;
  kpiName: string | null;
  kpiValue: Prisma.Decimal | null;
}): KpiInput | null {
  const { kpiMetric: metric, kpiTarget, kpiName, kpiValue } = project;
  if (!metric || !kpiTarget) return null;
  const target = kpiTarget.toFixed(4);
  if (metric === MANUAL_KPI) {
    return kpiName !== null && kpiValue ? { metric: MANUAL_KPI, name: kpiName, value: kpiValue.toFixed(4), target } : null;
  }
  return isKpiMetric(metric) ? { metric, target } : null;
}

export class PrismaKpiMonthClaims implements KpiMonthClaims {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(projectId: string, month: string): Promise<boolean> {
    const claimed = await this.prisma.$executeRaw`
      UPDATE project SET kpi_met_month = ${month}::date
      WHERE id = ${projectId} AND kpi_met_month IS DISTINCT FROM ${month}::date`;
    return claimed === 1;
  }
}
