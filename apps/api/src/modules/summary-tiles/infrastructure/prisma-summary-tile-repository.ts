import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { SummaryTileRepository } from "../application/ports.js";
import type { AccountTiles, SummaryAccount, SummaryTile } from "../domain/summary-tiles.js";

export class PrismaSummaryTileRepository implements SummaryTileRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async readDashboard(membershipId: string): Promise<SummaryTile[]> {
    const row = await this.prisma.membership.findUniqueOrThrow({
      where: { id: membershipId }, select: { dashboardTiles: true },
    });
    return row.dashboardTiles;
  }

  async writeDashboard(context: TransactionContext, membershipId: string, tiles: readonly SummaryTile[]): Promise<void> {
    await this.client(context).membership.update({
      where: { id: membershipId }, data: { dashboardTiles: [...tiles] },
    });
  }

  async readProject(projectId: string): Promise<SummaryTile[]> {
    const row = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId }, select: { summaryTiles: true },
    });
    return row.summaryTiles;
  }

  async writeProject(context: TransactionContext, projectId: string, tiles: readonly SummaryTile[]): Promise<void> {
    await this.client(context).project.update({
      where: { id: projectId }, data: { summaryTiles: [...tiles] },
    });
  }

  async readAccounts(projectId: string): Promise<AccountTiles[]> {
    const rows = await this.prisma.projectAccountSummary.findMany({
      where: { projectId },
      orderBy: [{ channel: "asc" }, { accountId: "asc" }],
      select: { channel: true, accountId: true, tiles: true },
    });
    return rows.map(({ channel, accountId, tiles }) => ({ account: { channel, accountId }, tiles }));
  }

  async writeAccount(
    context: TransactionContext,
    projectId: string,
    { channel, accountId }: SummaryAccount,
    tiles: readonly SummaryTile[],
  ): Promise<void> {
    await this.client(context).projectAccountSummary.upsert({
      where: { projectId_channel_accountId: { projectId, channel, accountId } },
      create: { projectId, channel, accountId, tiles: [...tiles] },
      update: { tiles: [...tiles] },
    });
  }
}
