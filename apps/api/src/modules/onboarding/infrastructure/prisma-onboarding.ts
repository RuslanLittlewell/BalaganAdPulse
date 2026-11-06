import type { PrismaClient } from "@prisma/client";
import type { ActorContext, Clock } from "#shared/application/index.js";
import type { OnboardingMarks, OnboardingReader, OnboardingSnapshot } from "../application/ports.js";

const STAFF_ROLES = ["ADMIN", "MANAGER", "GUEST"] as const;

const filled = (value: string | null) => value !== null && value.trim() !== "";

export class PrismaOnboardingReader implements OnboardingReader {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: Clock,
  ) {}

  async read(actor: ActorContext): Promise<OnboardingSnapshot | null> {
    const { orgId, membershipId } = actor;
    const ofOrganization = { client: { orgId } };
    const now = this.clock.now();
    const [membership, clients, projects, firstProject, adAccounts, otherStaff, pendingEmployeeInvites] = await Promise.all([
      this.prisma.membership.findUnique({
        where: { id: membershipId },
        select: {
          welcomedAt: true,
          onboardingHiddenAt: true,
          user: { select: { phone: true, telegram: true } },
          org: { select: { tariff: true, kpiTarget: true } },
        },
      }),
      this.prisma.client.count({ where: { orgId } }),
      this.prisma.project.count({ where: ofOrganization }),
      this.prisma.project.findFirst({ where: ofOrganization, orderBy: { createdAt: "asc" }, select: { id: true } }),
      this.prisma.projectIntegration.count({ where: { project: ofOrganization } }),
      this.prisma.membership.count({
        where: { orgId, status: "ACTIVE", role: { in: [...STAFF_ROLES] }, id: { not: membershipId } },
      }),
      this.prisma.invite.count({
        where: {
          orgId,
          registrationType: "EMPLOYEE",
          usedAt: null,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
    ]);
    if (!membership) return null;
    return {
      tariff: membership.org.tariff,
      welcomedAt: membership.welcomedAt,
      hiddenAt: membership.onboardingHiddenAt,
      firstProjectId: firstProject?.id ?? null,
      facts: {
        clients,
        projects,
        adAccounts,
        otherStaff,
        pendingEmployeeInvites,
        kpiTarget: membership.org.kpiTarget !== null,
        profileFilled: filled(membership.user.phone) || filled(membership.user.telegram),
      },
    };
  }
}

export class PrismaOnboardingMarks implements OnboardingMarks {
  constructor(private readonly prisma: PrismaClient) {}

  async welcome(membershipId: string, at: Date): Promise<void> {
    await this.prisma.membership.updateMany({ where: { id: membershipId, welcomedAt: null }, data: { welcomedAt: at } });
  }

  async hide(membershipId: string, at: Date): Promise<void> {
    await this.prisma.membership.updateMany({
      where: { id: membershipId, onboardingHiddenAt: null },
      data: { onboardingHiddenAt: at },
    });
  }
}
