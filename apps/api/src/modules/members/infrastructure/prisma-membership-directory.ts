import type { PrismaClient } from "@prisma/client";
import type { ActiveMembership, MembershipDirectory } from "../application/ports.js";

export class PrismaMembershipDirectory implements MembershipDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveByUserId(userId: string): Promise<ActiveMembership | null> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true, orgId: true, role: true, org: { select: { status: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) return null;
    return {
      actor: {
        userId,
        membershipId: membership.id,
        orgId: membership.orgId,
        role: membership.role,
      },
      organizationStatus: membership.org.status,
    };
  }
}
