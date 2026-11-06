import type { PrismaClient } from "@prisma/client";
import type { ActorContext } from "#shared/application/index.js";
import type { FeedbackSenders } from "../application/ports.js";
import type { FeedbackSender } from "../domain/feedback.js";

export class PrismaFeedbackSenders implements FeedbackSenders {
  constructor(private readonly prisma: PrismaClient) {}

  async describe(actor: ActorContext): Promise<FeedbackSender | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { id: actor.membershipId },
      select: {
        role: true,
        user: { select: { name: true, email: true, login: true } },
        org: { select: { name: true, tariff: true } },
      },
    });
    if (!membership) return null;
    return {
      name: membership.user.name,
      email: membership.user.email,
      login: membership.user.login,
      role: membership.role,
      organization: membership.org.name,
      tariff: membership.org.tariff,
    };
  }
}
