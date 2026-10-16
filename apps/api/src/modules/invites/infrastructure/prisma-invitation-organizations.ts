import type { PrismaClient } from "@prisma/client";
import type { InvitationOrganizations } from "../application/ports.js";

export class PrismaInvitationOrganizations implements InvitationOrganizations {
  constructor(private readonly prisma: PrismaClient) {}

  async isActive(orgId: string): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { status: true },
    });
    return organization?.status === "ACTIVE";
  }
}
