import { TARIFF_PLANS } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { onboardingSteps, type OnboardingStep } from "../domain/steps.js";
import type { OnboardingDependencies } from "./ports.js";

export interface OnboardingView {
  readonly welcomed: boolean;
  readonly hidden: boolean;
  readonly steps: readonly OnboardingStep[];
  readonly firstProjectId: string | null;
}

export function createOnboardingUseCases(dependencies: OnboardingDependencies) {
  return {
    describe: async (actor: ActorContext): Promise<OnboardingView> => {
      if (actor.role === "PARTNER") throw new AppError("forbidden", "Onboarding is not available to partners");
      const [snapshot, telegram] = await Promise.all([
        dependencies.reader.read(actor),
        dependencies.telegram.status(actor),
      ]);
      if (!snapshot) throw new AppError("forbidden", "Only a member of an organization has onboarding");
      const steps = onboardingSteps(
        {
          role: actor.role,
          userLimit: TARIFF_PLANS[snapshot.tariff].limits.users,
          telegramOffered: telegram.available,
        },
        { ...snapshot.facts, telegramLinked: telegram.linked },
      );
      return {
        welcomed: snapshot.welcomedAt !== null,
        hidden: snapshot.hiddenAt !== null,
        steps,
        firstProjectId: snapshot.firstProjectId,
      };
    },

    welcome: (actor: ActorContext) => dependencies.marks.welcome(actor.membershipId, dependencies.clock.now()),

    hide: (actor: ActorContext) => dependencies.marks.hide(actor.membershipId, dependencies.clock.now()),
  };
}

export type OnboardingUseCases = ReturnType<typeof createOnboardingUseCases>;
