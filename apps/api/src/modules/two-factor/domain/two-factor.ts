import type { Role } from "@adpulse/access-policy";

export const CHALLENGE_MS = 5 * 60_000;
export const BACKUP_CODE_COUNT = 10;
export const TWO_FACTOR_SETUP_REQUIRED = "TWO_FACTOR_SETUP_REQUIRED";
export const CHALLENGE_EXPIRED = "TWO_FACTOR_CHALLENGE_EXPIRED";
export const ISSUER = "Balagan BI";

const EMPLOYEE_ROLES: readonly Role[] = ["ADMIN", "MANAGER", "GUEST"];

export function isEmployee(role: Role): boolean {
  return EMPLOYEE_ROLES.includes(role);
}

export function isAppCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, "").toLowerCase();
}

export interface TrustedAddressRecord {
  readonly id: string;
  readonly address: string;
  readonly confirmedAt: Date;
  readonly lastUsedAt: Date;
}

export interface TwoFactorRecord {
  readonly sealedSecret: string | null;
  readonly sealedPending: string | null;
  readonly enabledAt: Date | null;
  readonly lastStep: number | null;
}
