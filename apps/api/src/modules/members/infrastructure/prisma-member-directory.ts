import { ROLES, isCustomer } from "@adpulse/access-policy";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import type { MemberChange, MemberRecord } from "../domain/member.js";
import type { MemberDirectory , MemberKind } from "../application/ports.js";

/** The password hash is excluded by selection rather than by deletion, so a
 * column added to the user table later is not exposed by default. */
const SELECT = {
  id: true,
  userId: true,
  orgId: true,
  role: true,
  status: true,
  createdAt: true,
  user: { select: { name: true, email: true, image: true, phone: true, telegram: true } },
} as const;

type Row = {
  id: string; userId: string; orgId: string; role: MemberRecord["role"];
  status: MemberRecord["status"]; createdAt: Date;
  user: {
    name: string; email: string; image: string | null;
    phone: string | null; telegram: string | null;
  };
};

/** Flattened for the caller: the team screen lists people, and a nested `user`
 * object would make every consumer reach through it. */
function toDomain(row: Row): MemberRecord {
  return {
    id: row.id,
    userId: row.userId,
    orgId: row.orgId,
    name: row.user.name,
    email: row.user.email,
    image: row.user.image,
    phone: row.user.phone,
    telegram: row.user.telegram,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
  };
}

const CUSTOMER_ROLES = ROLES.filter(isCustomer);

export class PrismaMemberDirectory implements MemberDirectory {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async listByOrg(orgId: string, kind?: MemberKind): Promise<MemberRecord[]> {
    const rows = await this.prisma.membership.findMany({
      // Staff is everyone but the customers, stated as the exclusion it is and
      // derived from the one predicate that answers which side a role is on. A
      // customer role added later is excluded without anybody remembering to.
      where: { orgId, ...(kind === "staff" ? { role: { notIn: CUSTOMER_ROLES } } : {}) },
      select: SELECT,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomain);
  }

  async listByClient(orgId: string, clientId: string): Promise<MemberRecord[]> {
    const rows = await this.prisma.membership.findMany({
      // Granted the client, whether the grant names the client itself or one of
      // its projects — both mean this person belongs to it.
      where: { orgId, access: { some: { OR: [{ clientId }, { project: { clientId } }] } } },
      select: SELECT,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomain);
  }

  async findInOrg(orgId: string, id: string): Promise<MemberRecord | null> {
    const row = await this.prisma.membership.findFirst({ where: { id, orgId }, select: SELECT });
    return row && toDomain(row);
  }

  async update(
    context: TransactionContext,
    id: string,
    change: MemberChange,
  ): Promise<MemberRecord> {
    const row = await this.client(context).membership.update({
      where: { id },
      data: { role: change.role, status: change.status },
      select: SELECT,
    });
    return toDomain(row);
  }

  /** Removes the membership only. The account and everything the person entered
   * belong to the organization and stay exactly where they are. */
  async remove(context: TransactionContext, id: string): Promise<void> {
    await this.client(context).membership.delete({ where: { id } });
  }

  countOtherActiveAdmins(orgId: string, exceptId: string): Promise<number> {
    return this.prisma.membership.count({
      where: { orgId, role: "ADMIN", status: "ACTIVE", id: { not: exceptId } },
    });
  }
}
