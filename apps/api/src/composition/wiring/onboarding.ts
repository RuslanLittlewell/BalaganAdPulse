import { prisma } from "#shared/infrastructure/prisma.js";
import { createOnboardingRouter, createOnboardingUseCases, type TelegramLinkStatus } from "#modules/onboarding/index.js";
import { PrismaOnboardingMarks, PrismaOnboardingReader } from "#modules/onboarding/infrastructure/prisma-onboarding.js";
import type { Kernel } from "./kernel.js";

export function wireOnboarding({ clock }: Kernel, { telegram }: { telegram: TelegramLinkStatus }) {
  const onboarding = createOnboardingUseCases({
    reader: new PrismaOnboardingReader(prisma, clock),
    marks: new PrismaOnboardingMarks(prisma),
    telegram,
    clock,
  });
  return { onboardingRouter: createOnboardingRouter(onboarding) };
}
