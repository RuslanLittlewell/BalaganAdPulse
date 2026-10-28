import type { Prisma, PrismaClient } from "@prisma/client";
import { isCustomer } from "@adpulse/access-policy";
import { performanceOf, sumByType, type KpiAccount, type MetricRepository, type ResultType } from "#modules/campaigns/index.js";
import { isKpiMetric, MANUAL_KPI, type IsoDateRange, type KpiFigures, type KpiInput } from "#modules/kpi/index.js";
import type {
  DueTask,
  DueTasks,
  KpiMonthClaims,
  MeasuredKpi,
  NotificationRecipients,
  NotificationRepository,
  ProjectKpiStandings,
} from "../application/ports.js";
import type { AddressedNotification, NewNotification, NotificationView } from "../domain/notification.js";

const shown = {
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true, projectId: true, dueDate: true, dueTime: true, timeZone: true } },
  document: { select: { id: true, title: true } },
  actor: { select: { user: { select: { name: true } } } },
} satisfies Prisma.NotificationInclude;

const dayOf = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

type StoredNotification = Prisma.NotificationGetPayload<{ include: typeof shown }>;

const viewOf = (row: StoredNotification, defaultTimeZone: string): NotificationView => ({
  id: row.id,
  kind: row.kind,
  createdAt: row.createdAt,
  readAt: row.readAt,
  project: row.project,
  task: row.task
    ? { ...row.task, dueDate: dayOf(row.task.dueDate), timeZone: row.task.timeZone ?? defaultTimeZone }
    : null,
  document: row.document,
  actor: row.actor ? { name: row.actor.user.name } : null,
});

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly defaultTimeZone: string,
  ) {}

  async createMany(notifications: readonly NewNotification[]): Promise<AddressedNotification[]> {
    const rows = await this.prisma.$transaction(notifications.map((data) =>
      this.prisma.notification.create({ data, include: shown })));
    return rows.map((row) => ({ ...viewOf(row, this.defaultTimeZone), recipientId: row.recipientId }));
  }

  async refreshUnread(notification: NewNotification, at: Date): Promise<AddressedNotification | null> {
    const { recipientId, kind, projectId, taskId, documentId, actorId } = notification;
    const unread = await this.prisma.notification.findFirst({
      where: { recipientId, kind, projectId, taskId, documentId, readAt: null },
      select: { id: true },
    });
    if (!unread) return null;
    const row = await this.prisma.notification.update({
      where: { id: unread.id }, data: { createdAt: at, actorId }, include: shown,
    });
    return { ...viewOf(row, this.defaultTimeZone), recipientId: row.recipientId };
  }

  async latest(recipientId: string, limit: number): Promise<NotificationView[]> {
    const rows = await this.prisma.notification.findMany({
      where: { recipientId },
      include: shown,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return rows.map((row) => viewOf(row, this.defaultTimeZone));
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
  constructor(
    private readonly prisma: PrismaClient,
    private readonly metrics: Pick<MetricRepository, "readTypedDays">,
  ) {}

  async read(projectId: string, range: IsoDateRange): Promise<MeasuredKpi[]> {
    const rows = await this.prisma.projectKpi.findMany({
      where: { projectId, enabled: true, project: { kpiTracked: true } }, orderBy: { position: "asc" },
      select: { metric: true, target: true, name: true, value: true, resultType: true, channel: true, sourceAccountId: true },
    });
    const measured = new Map<string, Promise<KpiFigures>>();
    const figuresFor = (account: KpiAccount | null) => {
      const key = account ? `${account.channel}:${account.accountId}` : "";
      if (!measured.has(key)) measured.set(key, this.figures(projectId, account, range));
      return measured.get(key)!;
    };
    return Promise.all(rows.flatMap((row) => {
      const kpi = kpiOf(row);
      if (!kpi) return [];
      const account = row.channel && row.sourceAccountId ? { channel: row.channel, accountId: row.sourceAccountId } : null;
      return [figuresFor(account).then((figures) => ({ kpi, figures }))];
    }));
  }

  private async figures(projectId: string, account: KpiAccount | null, range: IsoDateRange): Promise<KpiFigures> {
    const campaign = account ? { projectId, channel: account.channel, sourceAccountId: account.accountId } : { projectId };
    const sums = await this.prisma.campaignDailyMetric.aggregate({
      where: {
        campaign,
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
    const campaigns = await this.prisma.campaign.findMany({ where: campaign, select: { id: true, channel: true } });
    const typedDays = await this.metrics.readTypedDays(
      campaigns, new Date(`${range.from}T00:00:00Z`), new Date(`${range.to}T00:00:00Z`),
    );
    return { ...figures, resultTypes: sumByType(typedDays) };
  }
}

function kpiOf(row: {
  metric: string;
  target: Prisma.Decimal;
  name: string | null;
  value: Prisma.Decimal | null;
  resultType: string | null;
}): KpiInput | null {
  const target = row.target.toFixed(4);
  if (row.metric === MANUAL_KPI) {
    return row.name !== null && row.value ? { metric: MANUAL_KPI, name: row.name, value: row.value.toFixed(4), target } : null;
  }
  if (!isKpiMetric(row.metric)) return null;
  return row.resultType ? { metric: row.metric, target, resultType: row.resultType as ResultType } : { metric: row.metric, target };
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

export class PrismaDueTasks implements DueTasks {
  constructor(private readonly prisma: PrismaClient) {}

  async dueBetween(fromDay: string, toDay: string): Promise<DueTask[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: { gte: new Date(`${fromDay}T00:00:00Z`), lte: new Date(`${toDay}T00:00:00Z`) },
        column: { notIn: ["DONE", "ARCHIVED"] },
        org: { status: "ACTIVE", modules: { has: "TASKS" } },
      },
      select: {
        id: true, projectId: true, dueDate: true, dueTime: true, timeZone: true, createdById: true, visibleToClient: true, personal: true,
        participants: { select: { membershipId: true } },
      },
      orderBy: { dueDate: "asc" },
    });
    return tasks.map(({ participants, dueDate, ...task }) => ({
      ...task,
      dueDate: dayOf(dueDate)!,
      participantIds: participants.map(({ membershipId }) => membershipId),
    }));
  }

  async claim(taskId: string, deadline: Date): Promise<boolean> {
    const claimed = await this.prisma.$executeRaw`
      UPDATE task SET due_soon_for = (${deadline.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      WHERE id = ${taskId}
        AND due_soon_for IS DISTINCT FROM (${deadline.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
    return claimed === 1;
  }
}
