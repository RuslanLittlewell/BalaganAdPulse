export interface Account {
  accountId: string;
  currency: string;
  timezone: string;
}

export interface Integration extends Account {
  projectId: string;
  encryptedToken: string;
  revision: string;
  status: string;
  lastSuccessAt: Date | null;
  lastError: string | null;
  nextDailyAt: Date;
  queuedAt: Date | null;
  retryCount: number;
  leaseOwner: string | null;
  leaseUntil: Date | null;
}

export function publicIntegration(row: Integration | null) {
  if (!row) return null;
  const { accountId, currency, timezone, status, lastSuccessAt, lastError, nextDailyAt } = row;
  return { accountId, currency, timezone, status, lastSuccessAt, lastError, nextDailyAt };
}

export class MetaError extends Error {
  constructor(
    readonly code: "TOKEN" | "CURRENCY" | "PROVIDER" | "INVALID_DATA" | "CONFIGURATION" | "CONFLICT",
    readonly retryAfterMs = 0,
    readonly detail = "",
  ) {
    super(`Meta integration: ${code}`);
  }
}
