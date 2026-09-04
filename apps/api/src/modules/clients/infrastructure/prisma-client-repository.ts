import type { Client as ClientRow, Prisma, PrismaClient } from "@prisma/client";
import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
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
