import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { LeadBoard, LeadFields, LeadRecord, LeadStage } from '../domain/lead.js';
export interface LeadRepository {
  boards(actor: ActorContext): Promise<LeadBoard[]>;
  reaches(actor: ActorContext, board: string): Promise<boolean>;
  list(actor: ActorContext, board: string, context?: TransactionContext): Promise<LeadRecord[]>;
  lock(context: TransactionContext, actor: ActorContext, board: string): Promise<void>;
  reachesProject(actor: ActorContext, board: string, projectId: string): Promise<boolean>;
  campaignInProject(campaignId: string, projectId: string): Promise<boolean>;
  create(context: TransactionContext, input: LeadFields & {id: string; orgId: string; clientId: string | null; stage: LeadStage; position: number}): Promise<LeadRecord>;
  update(context: TransactionContext, id: string, input: Partial<LeadFields> & {stage?: LeadStage; position?: number}): Promise<LeadRecord>;
  delete(context: TransactionContext, id: string): Promise<void>;
}
export interface LeadEvent { kind: 'crm.changed'; orgId: string; board: string }
