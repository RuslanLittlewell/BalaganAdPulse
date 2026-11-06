import type { LimitedResource, Tariff, TariffLimits } from "@adpulse/access-policy";
import { t } from "@/shared/config/index.js";

export interface TariffSummary {
  tariff: Tariff;
  trialEndsAt: string | null;
  trialExpired: boolean;
  limits: TariffLimits;
  usage: Readonly<Record<LimitedResource, number>>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const tariffName = (tariff: Tariff): string => t(`tariff.name.${tariff}`);
export const tariffPrice = (tariff: Tariff): string => t(`tariff.price.${tariff}`);
export const tariffAudience = (tariff: Tariff): string => t(`tariff.audience.${tariff}`);
export const resourceLabel = (resource: LimitedResource): string => t(`tariff.limit.${resource}`);

export function usageLabel(used: number, limit: number | null): string {
  return limit === null ? `${used}, ${t("tariff.unlimited")}` : `${used} ${t("tariff.of")} ${limit}`;
}

export function trialDaysLeft(trialEndsAt: string, now: Date): number {
  return Math.max(0, Math.ceil((Date.parse(trialEndsAt) - now.getTime()) / DAY_MS));
}
