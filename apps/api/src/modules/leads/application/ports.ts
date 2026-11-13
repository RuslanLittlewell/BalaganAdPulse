import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { StoredLeadFile, LeadFileRecord } from '../domain/lead-file.js';
import type { LeadNoteRecord } from '../domain/lead-note.js';
import type { LeadHistoryEvent } from '../domain/lead-activity.js';
import type { LeadFieldRecord, LeadFieldType, FieldOption, OptionColor } from '../domain/lead-field.js';
import type { CompanyFields, CompanyRecord, PersonFields, PersonRecord, RelatedLead } from '../domain/crm-record.js';
import type { ArrivalWindow, BoardStageCounts, LeadBoard, LeadColumnRecord, LeadFields, LeadRecord, LeadStage, ProjectStageCounts } from '../domain/lead.js';
export interface LeadRepository {
  boards(actor: ActorContext): Promise<LeadBoard[]>;
  reaches(actor: ActorContext, board: string): Promise<boolean>;
  list(actor: ActorContext, board: string, context?: TransactionContext): Promise<LeadRecord[]>;
  lock(context: TransactionContext, actor: ActorContext, board: string): Promise<void>;
  clientOf(board: string): Promise<string>;
  campaignInProject(campaignId: string, projectId: string): Promise<boolean>;
  assignees(actor: ActorContext, board: string): Promise<Array<{id:string;name:string;image:string|null;status:'ACTIVE'}>>;
  assigneeReachesBoard(actor: ActorContext, membershipId: string, board: string): Promise<boolean>;
  create(context: TransactionContext, input: LeadFields & {id: string; orgId: string; projectId: string; stage: string; position: number}): Promise<LeadRecord>;
  update(context: TransactionContext, id: string, input: Partial<LeadFields> & {stage?: string; position?: number}): Promise<LeadRecord>;
  delete(context: TransactionContext, id: string): Promise<string[]>;
  leadOnBoard(actor: ActorContext, board: string, id: string): Promise<{id: string; projectId: string; clientId: string} | null>;
  history(orgId: string, leadId: string): Promise<{events: LeadHistoryEvent[]; importedAt: Date | null}>;
  campaignNames(ids: readonly string[]): Promise<Map<string, string>>;
  columns(actor: ActorContext, board: string, context?: TransactionContext): Promise<LeadColumnRecord[]>;
  createColumn(context: TransactionContext, input: {id: string; orgId: string; projectId: string; name: string; afterStage: LeadStage | null; position: number; color: OptionColor}): Promise<LeadColumnRecord>;
  updateColumn(context: TransactionContext, id: string, input: {name?: string; afterStage?: LeadStage | null; position?: number; color?: OptionColor}): Promise<LeadColumnRecord>;
  deleteColumn(context: TransactionContext, id: string): Promise<void>;
  projectStageCounts(actor: ActorContext, window: ArrivalWindow): Promise<ProjectStageCounts[]>;
  boardStageCounts(actor: ActorContext, board: string, window: ArrivalWindow): Promise<BoardStageCounts>;
}
export interface LeadFieldRepository {
  list(orgId: string, board: string, context?: TransactionContext): Promise<LeadFieldRecord[]>;
  create(context: TransactionContext, input: {id: string; orgId: string; projectId: string; name: string; type: LeadFieldType; options: FieldOption[]; position: number}): Promise<LeadFieldRecord>;
  update(context: TransactionContext, id: string, input: {name?: string; options?: FieldOption[]; position?: number}): Promise<LeadFieldRecord>;
  delete(context: TransactionContext, id: string): Promise<void>;
}
export interface CrmRecordRepository {
  reachesClient(actor: ActorContext, clientId: string): Promise<boolean>;
  projectsOf(clientId: string): Promise<string[]>;
  lock(context: TransactionContext, orgId: string, clientId: string): Promise<void>;
  companies(actor: ActorContext, clientId: string): Promise<CompanyRecord[]>;
  people(actor: ActorContext, clientId: string): Promise<PersonRecord[]>;
  company(actor: ActorContext, clientId: string, id: string, context?: TransactionContext): Promise<CompanyRecord | null>;
  person(actor: ActorContext, clientId: string, id: string, context?: TransactionContext): Promise<PersonRecord | null>;
  createCompany(context: TransactionContext, actor: ActorContext, input: {id: string; orgId: string; clientId: string} & CompanyFields): Promise<CompanyRecord>;
  createPerson(context: TransactionContext, actor: ActorContext, input: {id: string; orgId: string; clientId: string} & PersonFields): Promise<PersonRecord>;
  updateCompany(context: TransactionContext, actor: ActorContext, id: string, input: Partial<CompanyFields>): Promise<CompanyRecord>;
  updatePerson(context: TransactionContext, actor: ActorContext, id: string, input: Partial<PersonFields>): Promise<PersonRecord>;
  deleteCompany(context: TransactionContext, id: string): Promise<void>;
  deletePerson(context: TransactionContext, id: string): Promise<void>;
  companyInClient(orgId: string, clientId: string, id: string, context?: TransactionContext): Promise<boolean>;
  personInClient(orgId: string, clientId: string, id: string, context?: TransactionContext): Promise<boolean>;
  relatedLeads(actor: ActorContext, link: {personId: string} | {companyId: string}): Promise<RelatedLead[]>;
  companyPeople(actor: ActorContext, companyId: string): Promise<PersonRecord[]>;
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
export interface LeadNoteRepository {
  list(leadId: string): Promise<LeadNoteRecord[]>;
  find(leadId: string, id: string): Promise<LeadNoteRecord | null>;
  create(input: {id: string; orgId: string; leadId: string; authorId: string; body: string}): Promise<LeadNoteRecord>;
  edit(id: string, changes: {body: string; editedAt: Date}): Promise<LeadNoteRecord>;
  delete(id: string): Promise<void>;
}
export type LeadEventResource = 'leads' | 'notes' | 'columns' | 'fields' | 'activity' | 'files' | 'records' | 'counts';
export interface LeadEvent { kind: 'crm.changed'; orgId: string; board: string; resources?: readonly LeadEventResource[]; leadId?: string }
