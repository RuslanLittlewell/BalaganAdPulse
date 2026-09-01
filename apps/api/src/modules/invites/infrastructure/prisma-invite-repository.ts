import type { Invite as InviteRow, Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import type { Invite } from "../domain/invite.js";
import type { InviteRepository, NewInvite } from "../application/ports.js";

/** The row and the domain type happen to line up field for field today. The
 * mapping is written out anyway so a column added to the schema does not leak
 * into the domain by accident. */
function toDomain(row: InviteRow): Invite {
  return {
    id: row.id,
    orgId: row.orgId,
    code: row.code,
    role: row.role,
    email: row.email,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    usedAt: row.usedAt,
    usedById: row.usedById,
    createdById: row.createdById,
    createdAt: row.createdAt,
  };
}

export class PrismaInviteRepository implements InviteRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async create(context: TransactionContext, input: NewInvite): Promise<Invite> {
    return toDomain(await this.client(context).invite.create({ data: { ...input } }));
  }

  async listByOrg(orgId: string): Promise<Invite[]> {
    const rows = await this.prisma.invite.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  /** Scoped to the organization, so an invitation belonging to another agency
   * is indistinguishable from one that does not exist. */
  async findInOrg(orgId: string, id: string): Promise<Invite | null> {
    const row = await this.prisma.invite.findFirst({ where: { id, orgId } });
    return row && toDomain(row);
  }

  async findByCode(context: TransactionContext, code: string): Promise<Invite | null> {
    const row = await this.client(context).invite.findUnique({ where: { code } });
    return row && toDomain(row);
  }

  async revoke(context: TransactionContext, id: string, at: Date): Promise<void> {
    await this.client(context).invite.update({ where: { id }, data: { revokedAt: at } });
  }

  /** Conditional on the row still being unspent, which is what settles a race
   * between two registrations redeeming the same code. */
  async claim(
    context: TransactionContext,
    id: string,
    userId: string,
    at: Date,
  ): Promise<boolean> {
    const claimed = await this.client(context).invite.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at, usedById: userId },
    });
    return claimed.count === 1;
  }
}
