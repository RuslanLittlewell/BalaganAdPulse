import type { LimitedResource, Tariff } from "@adpulse/access-policy";

export interface OrganizationSubscription {
  readonly tariff: Tariff;
  readonly trialEndsAt: Date | null;
}

export interface OrganizationSubscriptions {
  findById(orgId: string): Promise<OrganizationSubscription | null>;
}

export type TariffUsage = Readonly<Record<LimitedResource, number>>;

export interface UsageCounter {
  count(orgId: string, resource: LimitedResource): Promise<number>;
  countAll(orgId: string): Promise<TariffUsage>;
}

export interface TariffDependencies {
  readonly subscriptions: OrganizationSubscriptions;
  readonly usage: UsageCounter;
  readonly clock: { now(): Date };
}
