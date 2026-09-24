import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { StoredLeadFile, LeadFileRecord } from '../domain/lead-file.js';
import type { LeadHistoryEvent } from '../domain/lead-activity.js';
import type { ArrivalWindow, LeadBoard, LeadColumnRecord, LeadFields, LeadRecord, LeadStage, ProjectStageCounts } from '../domain/lead.js';
export interface LeadRepository {
  boards(actor: ActorContext): Promise<LeadBoard[]>;
  reaches(actor: ActorContext, board: string): Promise<boolean>;
  list(actor: ActorContext, board: string, context?: TransactionContext): Promise<LeadRecord[]>;
  lock(context: TransactionContext, actor: ActorContext, board: string): Promise<void>;
  campaignInProject(campaignId: string, projectId: string): Promise<boolean>;
  assigneeReachesBoard(orgId: string, membershipId: string, board: string): Promise<boolean>;
  create(context: TransactionContext, input: LeadFields & {id: string; orgId: string; projectId: string; stage: string; position: number}): Promise<LeadRecord>;
  update(context: TransactionContext, id: string, input: Partial<LeadFields> & {stage?: string; position?: number}): Promise<LeadRecord>;
  delete(context: TransactionContext, id: string): Promise<string[]>;
  leadOnBoard(orgId: string, board: string, id: string): Promise<{id: string; projectId: string; clientId: string} | null>;
  history(orgId: string, leadId: string): Promise<{events: LeadHistoryEvent[]; importedAt: Date | null}>;
  campaignNames(ids: readonly string[]): Promise<Map<string, string>>;
  columns(actor: ActorContext, board: string, context?: TransactionContext): Promise<LeadColumnRecord[]>;
  createColumn(context: TransactionContext, input: {id: string; orgId: string; projectId: string; name: string; afterStage: LeadStage | null; position: number}): Promise<LeadColumnRecord>;
  updateColumn(context: TransactionContext, id: string, input: {name?: string; afterStage?: LeadStage | null; position?: number}): Promise<LeadColumnRecord>;
  deleteColumn(context: TransactionContext, id: string): Promise<void>;
  projectStageCounts(actor: ActorContext, window: ArrivalWindow): Promise<ProjectStageCounts[]>;
}
export interface LeadFileRepository {
  list(leadId: string): Promise<LeadFileRecord[]>;
  find(leadId: string, id: string): Promise<StoredLeadFile | null>;
  create(context: TransactionContext, input: {id: string; orgId: string; leadId: string; name: string; contentType: string; bytes: number; storageKey: string; uploaderId: string}): Promise<LeadFileRecord>;
  delete(context: TransactionContext, id: string): Promise<void>;
}
export interface LeadFileStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{body: Uint8Array}>;
  remove(keys: readonly string[]): Promise<void>;
}
export interface LeadEvent { kind: 'crm.changed'; orgId: string; board: string }
