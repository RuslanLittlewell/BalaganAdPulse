import { partnerForMembership } from "#shared/infrastructure/partner-scope.js";
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
    const partner = membership.role === "PARTNER" ? await partnerForMembership(this.prisma, membership.id, membership.orgId) : undefined;
    if (membership.role === "PARTNER" && !partner) return null;
    return {
      actor: {
        userId,
        membershipId: membership.id,
        orgId: membership.orgId,
        role: membership.role,
        ...(partner ? { partner } : {}),
      },
      organizationStatus: membership.org.status,
    };
  }
}
