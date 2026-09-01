import type { PrismaClient } from "@prisma/client";
import type { InvitationProjectReach } from "../application/ports.js";

export class PrismaInvitationProjectReach implements InvitationProjectReach {
  constructor(private readonly prisma: PrismaClient) {}

  async allBelongToOrg(orgId: string, projectIds: readonly string[]): Promise<boolean> {
    const uniqueIds = [...new Set(projectIds)];
    const count = await this.prisma.project.count({
      where: { id: { in: uniqueIds }, client: { orgId } },
    });
    return count === uniqueIds.length;
  }
}
