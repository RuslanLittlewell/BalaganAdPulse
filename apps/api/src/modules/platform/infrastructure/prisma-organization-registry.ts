import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "#shared/domain/index.js";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import type { OrganizationRecord } from "../domain/organization.js";
import type { NewOrganization, OrganizationChange, OrganizationRegistry } from "../application/ports.js";

const summary = {
  id: true,
  name: true,
  slug: true,
  status: true,
  modules: true,
  createdAt: true,
  _count: { select: { members: { where: { status: "ACTIVE" } } } },
  invites: {
    where: { registrationType: "EMPLOYEE", role: "ADMIN", createdById: null },
    orderBy: { createdAt: "asc" },
    take: 1,
    select: { email: true, code: true, usedAt: true, revokedAt: true, expiresAt: true },
  },
} satisfies Prisma.OrganizationSelect;

type SummaryRow = Prisma.OrganizationGetPayload<{ select: typeof summary }>;

function toRecord(row: SummaryRow): OrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    modules: row.modules,
    activeMembers: row._count.members,
    createdAt: row.createdAt,
    firstAdminInvitation: row.invites[0] ?? null,
  };
}

export class PrismaOrganizationRegistry implements OrganizationRegistry {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>,
  ) {}

  private client(context: TransactionContext): Prisma.TransactionClient {
    return this.unitOfWork.clientFor<Prisma.TransactionClient>(context);
  }

  async list(): Promise<OrganizationRecord[]> {
    const rows = await this.prisma.organization.findMany({
      select: summary,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<OrganizationRecord | null> {
    const row = await this.prisma.organization.findUnique({ where: { id }, select: summary });
    return row && toRecord(row);
  }

  async slugsStartingWith(base: string): Promise<string[]> {
    const rows = await this.prisma.organization.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    return rows.map(({ slug }) => slug);
  }

  async create(context: TransactionContext, input: NewOrganization): Promise<void> {
    try {
      await this.client(context).organization.create({
        data: { id: input.id, name: input.name, slug: input.slug, modules: [...input.modules] },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("conflict", "An organization with this address already exists");
      }
      throw error;
    }
  }

  async update(context: TransactionContext, id: string, change: OrganizationChange): Promise<void> {
    await this.client(context).organization.update({
      where: { id },
      data: {
        name: change.name,
        status: change.status,
        modules: change.modules && [...change.modules],
      },
    });
  }

  async delete(context: TransactionContext, id: string): Promise<void> {
    const client = this.client(context);
    const people = await client.user.findMany({
      where: {
        memberships: { some: { orgId: id }, every: { orgId: id } },
        isPlatformAdmin: false,
      },
      select: { id: true },
    });
    await client.organization.delete({ where: { id } });
    await client.user.deleteMany({ where: { id: { in: people.map((person) => person.id) } } });
  }
}
