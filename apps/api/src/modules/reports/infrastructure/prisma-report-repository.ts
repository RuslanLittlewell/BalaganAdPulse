import { Prisma } from "@prisma/client";
import type { MonthlyReport, MonthlyReportAd, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import { AppError } from "#shared/domain/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { NewReport, ReportChange, ReportRepository } from "../application/ports.js";
import { firstDay, monthOf, type Month } from "../domain/month.js";
import type { ReportFigures, ReportRecord } from "../domain/report.js";

type Row = MonthlyReport & { ads: MonthlyReportAd[] };

const withAds = { ads: { orderBy: { position: "asc" } } } as const;

const json = (value: unknown) =>
  value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);

function toRecord(row: Row): ReportRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    month: monthOf(row.month),
    status: row.status,
    currency: row.currency,
    figures: row.figures as unknown as ReportFigures,
    computedAt: row.computedAt,
    leadsOverride: row.leadsOverride,
    messengerContacts: row.messengerContacts,
    conclusions: row.conclusions,
    plan: row.plan,
    adIds: row.ads.map((ad) => ad.adId),
    publishedAt: row.publishedAt,
    coverKey: row.coverKey,
    coverContentType: row.coverContentType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaReportRepository implements ReportRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext) {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async list(projectId: string) {
    const rows = await this.prisma.monthlyReport.findMany({
      where: { projectId }, include: withAds, orderBy: { month: "desc" },
    });
    return rows.map(toRecord);
  }

  async find(projectId: string, id: string) {
    const row = await this.prisma.monthlyReport.findFirst({ where: { id, projectId }, include: withAds });
    return row && toRecord(row);
  }

  async findById(id: string) {
    const row = await this.prisma.monthlyReport.findUnique({ where: { id }, include: withAds });
    return row && toRecord(row);
  }

  async listForProjects(projectIds: readonly string[]) {
    if (projectIds.length === 0) return [];
    const rows = await this.prisma.monthlyReport.findMany({
      where: { projectId: { in: [...projectIds] } },
      include: withAds,
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toRecord);
  }

  async exists(projectId: string, month: Month) {
    return (await this.prisma.monthlyReport.count({ where: { projectId, month: firstDay(month) } })) > 0;
  }

  async corrections(projectId: string, months: readonly Month[]) {
    const rows = await this.prisma.monthlyReport.findMany({
      where: { projectId, month: { in: months.map(firstDay) }, leadsOverride: { not: null } },
      select: { month: true, leadsOverride: true },
    });
    return new Map(rows.map((row) => [monthOf(row.month), row.leadsOverride!]));
  }

  async create(context: TransactionContext, report: NewReport) {
    try {
      const row = await this.client(context).monthlyReport.create({
        data: {
          id: report.id,
          projectId: report.projectId,
          month: firstDay(report.month),
          currency: report.currency,
          figures: report.figures as unknown as Prisma.InputJsonValue,
          computedAt: report.computedAt,
          createdById: report.createdById,
          ads: { create: report.adIds.map((adId, position) => ({ adId, position })) },
        },
        include: withAds,
      });
      return toRecord(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("conflict", "The project already has a report for this month");
      }
      throw error;
    }
  }

  async update(context: TransactionContext, id: string, change: ReportChange) {
    const client = this.client(context);
    const { adIds, figures, conclusions, plan, ...columns } = change;
    if (adIds) {
      await client.monthlyReportAd.deleteMany({ where: { reportId: id } });
      await client.monthlyReportAd.createMany({ data: adIds.map((adId, position) => ({ reportId: id, adId, position })) });
    }
    const row = await client.monthlyReport.update({
      where: { id },
      data: {
        ...columns,
        ...(figures !== undefined ? { figures: figures as unknown as Prisma.InputJsonValue } : {}),
        ...(conclusions !== undefined ? { conclusions: json(conclusions) } : {}),
        ...(plan !== undefined ? { plan: json(plan) } : {}),
      },
      include: withAds,
    });
    return toRecord(row);
  }

  async delete(context: TransactionContext, id: string) {
    await this.client(context).monthlyReport.delete({ where: { id } });
  }
}
