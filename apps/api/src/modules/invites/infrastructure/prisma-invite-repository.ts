import { Prisma, type PrismaClient } from "@prisma/client";
import type { TransactionContext } from "../../../shared/application/index.js";
import type { PrismaUnitOfWork } from "../../../shared/infrastructure/prisma-unit-of-work.js";
import type { Invite, RegistrationType } from "../domain/invite.js";
import { InvitationCodeConflictError, type InviteRepository, type NewInvite } from "../application/ports.js";

type InviteRow = Prisma.InviteGetPayload<{ include: { projects: true } }>;

const withProjects = { projects: true } as const;

function toDomain(row: InviteRow): Invite {
  return {
    id: row.id,
    orgId: row.orgId,
    code: row.code,
    registrationType: row.registrationType,
    role: row.role,
    clientId: row.clientId,
    projectIds: row.projects.map(({ projectId }) => projectId),
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
    const { projectIds = [], registrationType = "EMPLOYEE", ...data } = input;
    try {
      return toDomain(await this.client(context).invite.create({
        data: {
          ...data,
          registrationType,
          projects: { create: projectIds.map((projectId) => ({ projectId })) },
        },
        include: withProjects,
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2002"
        && Array.isArray(error.meta?.target)
        && error.meta.target.includes("code")) {
        throw new InvitationCodeConflictError();
      }
      throw error;
    }
  }

  async listByOrg(orgId: string): Promise<Invite[]> {
    const rows = await this.prisma.invite.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: withProjects,
    });
    return rows.map(toDomain);
  }

  async listPendingByOrg(orgId: string, now: Date, type?: RegistrationType): Promise<Invite[]> {
    const rows = await this.prisma.invite.findMany({
      where: {
        orgId,
        usedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(type ? { registrationType: type } : {}),
        AND: [{ OR: [
          { registrationType: "CLIENT" },
          { registrationType: "EMPLOYEE", projects: { some: {} } },
        ] }],
      },
      orderBy: { createdAt: "desc" },
      include: withProjects,
    });
    return rows.map(toDomain);
  }

  async findInOrg(orgId: string, id: string): Promise<Invite | null> {
    const row = await this.prisma.invite.findFirst({ where: { id, orgId }, include: withProjects });
    return row && toDomain(row);
  }

  async findByCode(context: TransactionContext, code: string): Promise<Invite | null> {
    const row = await this.client(context).invite.findUnique({ where: { code }, include: withProjects });
    return row && toDomain(row);
  }

  async revoke(context: TransactionContext, id: string, at: Date): Promise<void> {
    await this.client(context).invite.update({ where: { id }, data: { revokedAt: at } });
  }

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
