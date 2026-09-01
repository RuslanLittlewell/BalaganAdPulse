import type { PrismaClient } from "@prisma/client";
import type { ActorContext } from "../../../shared/application/index.js";
import type { MembershipDirectory } from "../application/ports.js";

/**
 * One indexed lookup against a unique key, run on every authenticated request.
 * A suspended membership is simply not found: the filter is part of the query
 * rather than a check afterwards, so there is no path where a suspended member
 * is resolved and then rejected.
 */
export class PrismaMembershipDirectory implements MembershipDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveByUserId(userId: string): Promise<ActorContext | null> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true, orgId: true, role: true },
      // Membership in several organizations is a later change; ordering keeps
      // the choice deterministic rather than leaving it to the planner.
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
