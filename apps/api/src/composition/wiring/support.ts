import { config } from "#shared/infrastructure/config.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import { createSupportRouter, createSupportUseCases } from "#modules/support/index.js";
import { PrismaFeedbackSenders } from "#modules/support/infrastructure/prisma-feedback-senders.js";
import { SupportMailer } from "#modules/support/infrastructure/support-mailer.js";
import type { Kernel } from "./kernel.js";

export function wireSupport({ mail, clock }: Kernel) {
  const support = createSupportUseCases({
    senders: new PrismaFeedbackSenders(prisma),
    mailbox: new SupportMailer(mail, config.supportEmail),
    clock,
  });
  return { supportRouter: createSupportRouter(support) };
}
