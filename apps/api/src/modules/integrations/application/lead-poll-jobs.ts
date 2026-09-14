import type { TransactionContext } from "#shared/application/index.js";
import type { LeadPollJob, MetaError } from "../domain/integration.js";
import type { PolledAd } from "../domain/snapshot.js";

export const LEAD_POLL_INTERVAL_MS = 10 * 60_000;
export const LEAD_ACCESS_RETRY_MS = 60 * 60_000;

export interface LeadPollOutcome {
  polled: boolean;
  swept: boolean;
  coveredUntil: Date | null;
}

export interface LeadPollJobs {
  claim(now: Date): Promise<LeadPollJob | null>;
  renew(job: LeadPollJob, now: Date): Promise<boolean>;
  sweepAds(job: LeadPollJob, since: Date): Promise<PolledAd[]>;
  hold(context: TransactionContext, job: LeadPollJob, now: Date): Promise<boolean>;
  succeed(context: TransactionContext, job: LeadPollJob, outcome: LeadPollOutcome, now: Date): Promise<void>;
  fail(job: LeadPollJob, error: MetaError, now: Date): Promise<void>;
}
