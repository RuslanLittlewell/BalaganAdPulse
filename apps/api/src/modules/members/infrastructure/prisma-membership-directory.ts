import type { PrismaClient } from "@prisma/client";
import type { ActorContext } from "#shared/application/index.js";
import type { MembershipDirectory } from "../application/ports.js";

export class PrismaMembershipDirectory implements MembershipDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveByUserId(userId: string): Promise<ActorContext | null> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true, orgId: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) return null;
    return {
      userId,
      membershipId: membership.id,
      orgId: membership.orgId,
      role: membership.role,
    };
  }
}
