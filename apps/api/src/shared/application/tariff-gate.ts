import type { LimitedResource } from "@adpulse/access-policy";

export interface TariffGate {
  assertCanAdd(orgId: string, resource: LimitedResource, adding?: number): Promise<void>;
}
