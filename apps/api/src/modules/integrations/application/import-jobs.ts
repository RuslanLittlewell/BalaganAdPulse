import type { Integration, MetaError } from "../domain/integration.js";
import type { Snapshot } from "../domain/snapshot.js";
export interface ImportJobs {
  claim(now: Date): Promise<Integration | null>;
  renew(job: Integration, now: Date): Promise<boolean>;
  complete(job: Integration, snapshot: Snapshot, now: Date): Promise<boolean>;
  fail(job: Integration, error: MetaError, now: Date): Promise<void>;
}
