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
  leadsStatus: string;
  leadsCoveredUntil: Date | null;
  leadsLastSuccessAt: Date | null;
  leadsLastError: string | null;
  nextLeadsAt: Date;
  leadsQueuedAt: Date | null;
  nextSweepAt: Date | null;
  leadsLeaseOwner: string | null;
  leadsLeaseUntil: Date | null;
}

export interface LeadPollJob extends Integration {
  orgId: string;
  clientId: string;
  pollDue: boolean;
  sweepDue: boolean;
}

export function publicIntegration(row: Integration | null) {
  if (!row) return null;
  const { accountId, currency, timezone, status, lastSuccessAt, lastError, nextDailyAt } = row;
  const leads = { status: row.leadsStatus, lastSuccessAt: row.leadsLastSuccessAt, lastError: row.leadsLastError };
  return { accountId, currency, timezone, status, lastSuccessAt, lastError, nextDailyAt, leads };
}

export class MetaError extends Error {
  constructor(
    readonly code: "TOKEN" | "ACCESS" | "CURRENCY" | "PROVIDER" | "INVALID_DATA" | "CONFIGURATION" | "CONFLICT",
    readonly retryAfterMs = 0,
    readonly detail = "",
  ) {
    super(`Meta integration: ${code}`);
  }
}
