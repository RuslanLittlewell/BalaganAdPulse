import type { PrismaClient } from "@prisma/client";
import type { LimitedResource } from "@adpulse/access-policy";
import type {
  OrganizationSubscription,
  OrganizationSubscriptions,
  TariffUsage,
  UsageCounter,
} from "../application/ports.js";

export class PrismaOrganizationSubscriptions implements OrganizationSubscriptions {
  constructor(private readonly prisma: PrismaClient) {}

  findById(orgId: string): Promise<OrganizationSubscription | null> {
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { tariff: true, trialEndsAt: true },
    });
  }
}

export class PrismaUsageCounter implements UsageCounter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: { now(): Date },
  ) {}

  count(orgId: string, resource: LimitedResource): Promise<number> {
    switch (resource) {
      case "projects":
        return this.prisma.project.count({ where: { client: { orgId } } });
      case "clients":
        return this.prisma.client.count({ where: { orgId } });
      case "adAccounts":
        return this.prisma.projectIntegration.count({ where: { project: { client: { orgId } } } });
      case "users":
        return this.users(orgId);
    }
  }

  async countAll(orgId: string): Promise<TariffUsage> {
    const [projects, clients, users, adAccounts] = await Promise.all([
      this.count(orgId, "projects"),
      this.count(orgId, "clients"),
      this.count(orgId, "users"),
      this.count(orgId, "adAccounts"),
    ]);
    return { projects, clients, users, adAccounts };
  }

  private async users(orgId: string): Promise<number> {
    const now = this.clock.now();
    const [members, invitations] = await Promise.all([
      this.prisma.membership.count({ where: { orgId, status: "ACTIVE" } }),
      this.prisma.invite.count({
        where: {
          orgId,
          usedAt: null,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
    ]);
    return members + invitations;
  }
}
