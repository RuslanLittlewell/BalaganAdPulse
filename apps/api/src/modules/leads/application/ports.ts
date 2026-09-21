import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { ArrivalWindow, LeadBoard, LeadColumnRecord, LeadFields, LeadRecord, LeadStage, ProjectStageCounts } from '../domain/lead.js';
export interface LeadRepository {
  boards(actor: ActorContext): Promise<LeadBoard[]>;
  reaches(actor: ActorContext, board: string): Promise<boolean>;
  list(actor: ActorContext, board: string, context?: TransactionContext): Promise<LeadRecord[]>;
  lock(context: TransactionContext, actor: ActorContext, board: string): Promise<void>;
  reachesProject(actor: ActorContext, board: string, projectId: string): Promise<boolean>;
  campaignInProject(campaignId: string, projectId: string): Promise<boolean>;
  assigneeReachesBoard(orgId: string, membershipId: string, board: string, projectId: string | null): Promise<boolean>;
  create(context: TransactionContext, input: LeadFields & {id: string; orgId: string; clientId: string | null; stage: string; position: number}): Promise<LeadRecord>;
  update(context: TransactionContext, id: string, input: Partial<LeadFields> & {stage?: string; position?: number}): Promise<LeadRecord>;
  delete(context: TransactionContext, id: string): Promise<void>;
  columns(actor: ActorContext, board: string, context?: TransactionContext): Promise<LeadColumnRecord[]>;
  createColumn(context: TransactionContext, input: {id: string; orgId: string; clientId: string | null; name: string; afterStage: LeadStage | null; position: number}): Promise<LeadColumnRecord>;
  updateColumn(context: TransactionContext, id: string, input: {name?: string; afterStage?: LeadStage | null; position?: number}): Promise<LeadColumnRecord>;
  deleteColumn(context: TransactionContext, id: string): Promise<void>;
  projectStageCounts(actor: ActorContext, window: ArrivalWindow): Promise<ProjectStageCounts[]>;
}
export interface LeadEvent { kind: 'crm.changed'; orgId: string; board: string }
