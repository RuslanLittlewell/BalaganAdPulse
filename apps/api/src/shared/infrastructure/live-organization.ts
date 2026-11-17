import type { Prisma } from "@prisma/client";

export function liveOrganizationFilter(now: Date): Prisma.OrganizationWhereInput {
  return { OR: [{ tariff: { not: "TRIAL" } }, { trialEndsAt: null }, { trialEndsAt: { gt: now } }] };
}

export function inLiveOrganization(now: Date) {
  return { project: { client: { org: liveOrganizationFilter(now) } } } as const;
}
