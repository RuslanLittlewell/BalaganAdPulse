import { isTrialExpired, TARIFF_PLANS, type LimitedResource } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { OrganizationSubscription, TariffDependencies } from "./ports.js";

export const TRIAL_ENDED = "The trial has ended. Ask the platform administrator to assign a tariff.";

const RESOURCE_NAMES: Readonly<Record<LimitedResource, string>> = {
  projects: "projects",
  clients: "clients",
  users: "users",
  adAccounts: "ad accounts",
};

export const limitReached = (resource: LimitedResource, limit: number): string =>
  `Tariff limit reached for ${RESOURCE_NAMES[resource]}: ${limit}. Upgrade the tariff to add more.`;

export function createTariffUseCases(dependencies: TariffDependencies) {
  const subscriptionOf = async (orgId: string): Promise<OrganizationSubscription> => {
    const subscription = await dependencies.subscriptions.findById(orgId);
    if (!subscription) throw new AppError("not-found", "Organization not found");
    return subscription;
  };

  const assertWritable = async (orgId: string): Promise<void> => {
    const subscription = await subscriptionOf(orgId);
    if (isTrialExpired(subscription, dependencies.clock.now())) {
      throw new AppError("forbidden", TRIAL_ENDED, [{ code: "TRIAL_ENDED" }]);
    }
  };

  return {
    assertWritable,

    assertCanAdd: async (orgId: string, resource: LimitedResource, adding = 1): Promise<void> => {
      await assertWritable(orgId);
      const { tariff } = await subscriptionOf(orgId);
      const limit = TARIFF_PLANS[tariff].limits[resource];
      if (limit === null) return;
      if ((await dependencies.usage.count(orgId, resource)) + adding > limit) {
        throw new AppError("forbidden", limitReached(resource, limit), [{ code: "TARIFF_LIMIT", resource, limit }]);
      }
    },

    describe: async (orgId: string) => {
      const subscription = await subscriptionOf(orgId);
      return {
        tariff: subscription.tariff,
        trialEndsAt: subscription.trialEndsAt,
        trialExpired: isTrialExpired(subscription, dependencies.clock.now()),
        limits: TARIFF_PLANS[subscription.tariff].limits,
        usage: await dependencies.usage.countAll(orgId),
      };
    },
  };
}

export type TariffUseCases = ReturnType<typeof createTariffUseCases>;
