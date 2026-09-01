import type {
  ActorContext,
  IdGenerator,
  TransactionContext,
  UnitOfWork,
} from "../../../shared/application/index.js";
import type { AuditWriter } from "../../audit/index.js";
import type { ComputedTable } from "../../campaigns/index.js";
import type { StoredCell, WritableProperty } from "../domain/value.js";

export interface RecordRow {
  readonly id: string;
  readonly campaignId: string;
  /** Bare `YYYY-MM-DD`; the adapter owns the timezone. */
  readonly date: string;
}

export interface RecordRepository {
  create(
    context: TransactionContext,
    input: { id: string; campaignId: string; date: Date },
  ): Promise<RecordRow>;
  findReachable(actor: ActorContext, id: string): Promise<RecordRow | null>;
  /** The row already holding this day, if any — the campaign may hold one per day. */
  findByDay(campaignId: string, date: Date): Promise<RecordRow | null>;
  update(context: TransactionContext, id: string, date: Date): Promise<RecordRow>;
  delete(context: TransactionContext, id: string): Promise<void>;
}

export interface ValueRepository {
  /** The columns of this campaign among the ids asked for. A short answer means
   * one of them belongs elsewhere. */
  propertiesOf(campaignId: string, propertyIds: readonly string[]): Promise<WritableProperty[]>;
  storedFor(recordId: string, propertyIds: readonly string[]): Promise<Map<string, StoredCell>>;
  write(
    context: TransactionContext,
    recordId: string,
    property: WritableProperty,
    value: string | null,
  ): Promise<void>;
}

/** What the records module needs from campaigns: whether the actor reaches one,
 * where it sits for the audit trail, and the recomputed table after a write. */
export interface CampaignReach {
  contextFor(
    actor: ActorContext,
    campaignId: string,
  ): Promise<{ clientId: string; projectId: string } | null>;
  readTable(actor: ActorContext, campaignId: string): Promise<ComputedTable | null>;
}

export interface RecordDependencies {
  readonly records: RecordRepository;
  readonly values: ValueRepository;
  readonly campaigns: CampaignReach;
  readonly audit: AuditWriter;
  readonly ids: IdGenerator;
  readonly unitOfWork: UnitOfWork;
}
