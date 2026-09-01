import type {
  ActorContext,
  IdGenerator,
  TransactionContext,
  UnitOfWork,
} from "../../../shared/application/index.js";
import type { AuditWriter } from "../../audit/index.js";
import type { Expression } from "../domain/expression.js";
import type { PropertyType } from "../domain/property.js";
import type { StoredValue } from "../domain/table.js";

export interface CampaignRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly position: number;
}

export interface PropertyRecord {
  readonly id: string;
  readonly campaignId: string;
  readonly key: string | null;
  readonly name: string;
  readonly type: PropertyType;
  readonly position: number;
  readonly formula: Expression | null;
}

export interface TableData {
  readonly campaign: CampaignRecord;
  readonly properties: readonly PropertyRecord[];
  readonly records: ReadonlyArray<{
    readonly id: string;
    readonly date: string;
    readonly storedValues: readonly StoredValue[];
  }>;
}

export interface CampaignRepository {
  create(
    context: TransactionContext,
    input: CampaignRecord,
  ): Promise<CampaignRecord>;
  countForProject(projectId: string): Promise<number>;
  listForProject(projectId: string): Promise<CampaignRecord[]>;
  findReachable(actor: ActorContext, id: string): Promise<CampaignRecord | null>;
  readTable(actor: ActorContext, id: string): Promise<TableData | null>;
  rename(context: TransactionContext, id: string, name: string): Promise<void>;
  delete(context: TransactionContext, id: string): Promise<void>;
  /** Rewrites positions to a dense 0..n-1 sequence, optionally moving one. */
  renumber(
    context: TransactionContext,
    projectId: string,
    movedId?: string,
    position?: number,
  ): Promise<void>;
}

export interface PropertyRepository {
  siblings(campaignId: string): Promise<PropertyRecord[]>;
  findReachable(actor: ActorContext, id: string): Promise<PropertyRecord | null>;
  create(context: TransactionContext, input: PropertyRecord): Promise<PropertyRecord>;
  shiftFrom(context: TransactionContext, campaignId: string, position: number): Promise<void>;
  update(
    context: TransactionContext,
    id: string,
    data: { name?: string; type?: PropertyType; formula?: Expression | null },
  ): Promise<void>;
  delete(context: TransactionContext, id: string): Promise<void>;
  renumber(
    context: TransactionContext,
    campaignId: string,
    movedId?: string,
    position?: number,
  ): Promise<void>;
  countValues(propertyId: string): Promise<number>;
}

/** Whether the actor may put work under this project, and which client it
 * belongs to — the audit trail records both. */
export interface ProjectReach {
  contextFor(actor: ActorContext, projectId: string): Promise<{ clientId: string } | null>;
}

export interface AuditContextLookup {
  forCampaign(campaignId: string): Promise<{ clientId: string; projectId: string; campaignId: string }>;
}

export interface CampaignDependencies {
  readonly campaigns: CampaignRepository;
  readonly properties: PropertyRepository;
  readonly projects: ProjectReach;
  readonly auditContext: AuditContextLookup;
  readonly audit: AuditWriter;
  readonly ids: IdGenerator;
  readonly unitOfWork: UnitOfWork;
}
