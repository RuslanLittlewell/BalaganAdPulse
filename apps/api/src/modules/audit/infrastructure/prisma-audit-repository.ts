import { Prisma } from "@prisma/client";
import type { AuditEvent, PrismaClient } from "@prisma/client";
import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { AuditScope, StoredAuditEvent } from "../domain/audit-event.js";
import type { ActorSnapshots, AuditQuery, AuditReach, AuditRepository } from "../application/ports.js";

function scopeToWhere(scope: AuditScope): Prisma.AuditEventWhereInput {
  if (scope.everything) return { orgId: scope.orgId };
  return {
    orgId: scope.orgId,
    OR: [
      { projectId: null, clientId: { in: [...scope.clientIds] } },
      { clientId: { in: [...scope.wholeClientIds] } },
      { projectId: { in: [...scope.projectIds] } },
    ],
  };
}

export class PrismaAuditRepository implements AuditRepository<AuditEvent> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  async append(context: TransactionContext, event: StoredAuditEvent): Promise<void> {
    const client = this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
    await client.auditEvent.create({
      data: {
        ...event,
        changes: event.changes === null
          ? Prisma.DbNull
          : (event.changes as unknown as Prisma.InputJsonValue),
      },
    });
  }

  async list(query: AuditQuery) {
    const filters: Prisma.AuditEventWhereInput = {
      clientId: query.filters.clientId,
      projectId: query.filters.projectId,
      campaignId: query.filters.campaignId,
      entityType: query.filters.entityType,
      entityId: query.filters.entityId,
      actorId: query.filters.actorId,
      createdAt: query.filters.from || query.filters.to ? {
        gte: query.filters.from ? new Date(query.filters.from) : undefined,
        lte: query.filters.to ? new Date(query.filters.to) : undefined,
      } : undefined,
    };
    const rows = await this.prisma.auditEvent.findMany({
      where: { AND: [scopeToWhere(query.scope), filters] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return { items, nextCursor: hasMore ? items.at(-1)!.id : null };
  }
}

export class PrismaAuditReach implements AuditReach {
  constructor(private readonly prisma: PrismaClient) {}

  async scopeFor(actor: ActorContext): Promise<AuditScope> {
    if (actor.role === "ADMIN") return { orgId: actor.orgId, everything: true };
    const grants = await this.prisma.clientAccess.findMany({
      where: { membershipId: actor.membershipId },
      select: { clientId: true, projectId: true },
    });
    return {
      orgId: actor.orgId,
      everything: false,
      clientIds: [...new Set(grants.map((grant) => grant.clientId))],
      wholeClientIds: grants.filter((grant) => grant.projectId === null).map((grant) => grant.clientId),
      projectIds: grants.flatMap((grant) => (grant.projectId ? [grant.projectId] : [])),
    };
  }
}

export class PrismaActorSnapshots implements ActorSnapshots {
  constructor(private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  async forMembership(context: TransactionContext, membershipId: string) {
    const client = this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
    const membership = await client.membership.findUniqueOrThrow({
      where: { id: membershipId },
      include: { user: { select: { name: true, email: true } } },
    });
    return membership.user;
  }
}
