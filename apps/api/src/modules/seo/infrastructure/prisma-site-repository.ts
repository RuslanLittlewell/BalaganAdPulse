import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "#shared/domain/index.js";
import { nextMorning, type TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { NewSite, SiteRepository } from "../application/ports.js";
import type { SeoSite } from "../domain/seo-site.js";

export class PrismaSiteRepository implements SiteRepository {
  constructor(private readonly prisma: PrismaClient, private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  list(projectId: string): Promise<SeoSite[]> {
    return this.prisma.seoSite.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  }

  read(projectId: string, id: string): Promise<SeoSite | null> {
    return this.prisma.seoSite.findFirst({ where: { id, projectId } });
  }

  async add(context: TransactionContext, site: NewSite, now: Date): Promise<SeoSite> {
    try {
      return await this.unitOfWork.clientFor(context).seoSite.create({ data: {
        ...site,
        revision: randomUUID(),
        status: "QUEUED",
        queuedAt: now,
        nextDailyAt: nextMorning(now),
        checkStatus: "QUEUED",
        checkQueuedAt: now,
        nextCheckAt: now,
      } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("conflict", "This site is already connected to the project");
      }
      throw error;
    }
  }

  renew(context: TransactionContext, id: string, encryptedToken: string, now: Date): Promise<SeoSite> {
    return this.unitOfWork.clientFor(context).seoSite.update({ where: { id }, data: {
      encryptedToken,
      revision: randomUUID(),
      status: "QUEUED",
      queuedAt: now,
      retryCount: 0,
      lastError: null,
      leaseOwner: null,
      leaseUntil: null,
    } });
  }

  async remove(context: TransactionContext, id: string): Promise<void> {
    await this.unitOfWork.clientFor(context).seoSite.deleteMany({ where: { id } });
  }

  async queueImport(id: string, now: Date): Promise<void> {
    const free = { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] };
    await this.prisma.seoSite.updateMany({ where: { id, status: "AUTH_REQUIRED", ...free }, data: { queuedAt: now } });
    await this.prisma.seoSite.updateMany({
      where: { id, status: { notIn: ["QUEUED", "RUNNING", "AUTH_REQUIRED"] }, ...free },
      data: { queuedAt: now, status: "QUEUED", lastError: null, retryCount: 0 },
    });
  }

  async queueCheck(id: string, now: Date): Promise<void> {
    await this.prisma.seoSite.updateMany({
      where: { id, checkStatus: { notIn: ["QUEUED", "RUNNING"] }, OR: [{ checkLeaseUntil: null }, { checkLeaseUntil: { lte: now } }] },
      data: { checkQueuedAt: now, checkStatus: "QUEUED" },
    });
  }
}
