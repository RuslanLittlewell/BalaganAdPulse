import type { PrismaClient } from "@prisma/client";
import type { ActorContext } from "#shared/application/index.js";
import { reachableCampaigns } from "#shared/infrastructure/partner-reach.js";
import type { InvitationCampaignReach } from "../application/ports.js";

export class PrismaInvitationCampaignReach implements InvitationCampaignReach {
  constructor(private readonly prisma: PrismaClient) {}

  async reachable(actor: ActorContext, campaignId: string): Promise<{ clientId: string } | null> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { AND: [{ id: campaignId }, reachableCampaigns(actor)] },
      select: { project: { select: { clientId: true } } },
    });
    return campaign && { clientId: campaign.project.clientId };
  }
}
