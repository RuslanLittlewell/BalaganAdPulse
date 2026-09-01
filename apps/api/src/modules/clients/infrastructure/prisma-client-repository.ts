import type { Client as ClientRow, Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext, TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import type { ClientContact, ClientRecord, NewClient } from "../domain/client.js";
import type { ClientRepository } from "../application/ports.js";

function toDomain(row: ClientRow): ClientRecord {
  return {
    id: row.id, orgId: row.orgId, name: row.name, fullName: row.fullName,
    organization: row.organization, unp: row.unp, phone: row.phone, telegram: row.telegram,
    email: row.email, website: row.website, image: row.image, avatarPath: row.avatarPath,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

/**
 * Which clients an actor can reach, as a query filter.
 *
 * This is the one place tenancy is spelled out. An admin reaches their whole
 * organization and needs no grant; everyone else reaches a client only where a
 * grant names it — of either kind, because being able to reach one project
 * means being able to see the client it belongs to.
 *
 * It is a `where` fragment rather than a check so that an unreachable id and a
 * missing id both return no rows: the response can then never be used to
 * discover that a record exists.
 */
function reachFilter(actor: ActorContext): Prisma.ClientWhereInput {
  if (actor.role === "ADMIN") return { orgId: actor.orgId };
  return {
    orgId: actor.orgId,
    access: { some: { membershipId: actor.membershipId } },
  };
}

export class PrismaClientRepository implements ClientRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async create(
    context: TransactionContext,
    input: NewClient & { id: string; orgId: string },
    grantTo: string | undefined,
  ): Promise<ClientRecord> {
    const row = await this.client(context).client.create({
      data: {
        ...input,
        ...(grantTo ? { access: { create: { membershipId: grantTo } } } : {}),
      },
    });
    return toDomain(row);
  }

  async listReachable(actor: ActorContext): Promise<ClientRecord[]> {
    const rows = await this.prisma.client.findMany({
      where: reachFilter(actor),
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  /** findFirst rather than findUnique: `where` on findUnique accepts only a
   * unique key, and reach is not part of one. */
  async findReachable(actor: ActorContext, id: string): Promise<ClientRecord | null> {
    const row = await this.prisma.client.findFirst({ where: { id, ...reachFilter(actor) } });
    return row && toDomain(row);
  }

  async update(
    context: TransactionContext,
    id: string,
    input: ClientContact,
  ): Promise<ClientRecord> {
    return toDomain(await this.client(context).client.update({ where: { id }, data: input }));
  }

  /** The schema cascades from client to projects to campaigns and their data,
   * so one delete is the whole removal. */
  async delete(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).client.delete({ where: { id } });
  }

  async reachableIds(actor: ActorContext): Promise<string[]> {
    const rows = await this.prisma.client.findMany({
      where: reachFilter(actor),
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => row.id);
  }
}
