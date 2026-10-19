import type { Role } from "@adpulse/access-policy";

export const LINK_TOKEN_TTL_MS = 15 * 60_000;

const BOT_ROLES: readonly Role[] = ["ADMIN", "MANAGER"];

export interface BotMembership {
  readonly role: Role;
  readonly active: boolean;
  readonly organizationActive: boolean;
  readonly tasksOn: boolean;
}

export function mayUseBot(membership: BotMembership): boolean {
  return membership.active && membership.organizationActive && membership.tasksOn
    && BOT_ROLES.includes(membership.role);
}

export function linkUrl(botUsername: string, token: string): string {
  return `https://t.me/${botUsername}?start=${token}`;
}
