import type { SyncKind } from "../domain/records.js";

export interface Bitrix24Api {
  call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  list<T = unknown>(method: string, params?: Record<string, unknown>): Promise<{ items: T[]; next: number | null }>;
}

export interface Bitrix24ApiFactory {
  open(webhookBase: string): Bitrix24Api;
}

export type ConnectionStatus = "ACTIVE" | "AUTH_REQUIRED";
export type RunDirection = "UPLOAD" | "DOWNLOAD";

export interface StoredConnection {
  id: string;
  orgId: string;
  portalHost: string;
  sealedWebhook: string;
  tokenHash: string;
  webhookKey: string;
  status: ConnectionStatus;
  enabled: boolean;
  inboundProjectId: string | null;
  connectedAt: Date;
  lastSyncAt: Date | null;
  lastError: string | null;
}

export interface ConnectionChange {
  portalHost?: string;
  sealedWebhook?: string;
  tokenHash?: string;
  status?: ConnectionStatus;
  enabled?: boolean;
  inboundProjectId?: string | null;
  lastSyncAt?: Date;
  lastError?: string | null;
}

export interface StageLink {
  stageKey: string;
  statusId: string;
}

export interface ProblemRecord {
  kind: string;
  key: string;
  reason: string;
  label: string | null;
  createdAt: Date;
}

export interface RunRecord {
  id: string;
  direction: RunDirection;
  state: "RUNNING" | "DONE" | "FAILED";
  created: number;
  failed: number;
  cursor: Record<string, unknown>;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface StageOption {
  key: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
}

export interface ConnectionRepository {
  findByOrg(orgId: string): Promise<StoredConnection | null>;
  findByKey(key: string): Promise<StoredConnection | null>;
  create(input: { orgId: string; portalHost: string; sealedWebhook: string; tokenHash: string; webhookKey: string; connectedAt: Date }): Promise<StoredConnection>;
  update(id: string, change: ConnectionChange): Promise<StoredConnection>;
  remove(id: string): Promise<void>;
  stageLinks(connectionId: string): Promise<StageLink[]>;
  setStageLinks(connectionId: string, links: readonly StageLink[]): Promise<void>;
  stageOptions(orgId: string): Promise<StageOption[]>;
  projectInOrganization(orgId: string, projectId: string): Promise<boolean>;
  problems(connectionId: string): Promise<ProblemRecord[]>;
  latestRun(connectionId: string): Promise<RunRecord | null>;
  startRun(connectionId: string, direction: RunDirection): Promise<RunRecord | null>;
  enqueue(connectionId: string, kind: SyncKind, remoteId: string): Promise<void>;
  claim(now: Date, owner: string, leaseMs: number, exclude: readonly string[]): Promise<StoredConnection | null>;
  requeueSkipped(connectionId: string): Promise<void>;
  release(id: string, owner: string): Promise<void>;
}

export interface Secrets {
  seal(value: string, orgId: string): string;
  unseal(value: string, orgId: string): string;
  hash(token: string): string;
  matches(token: string, hash: string): boolean;
  newKey(): string;
}

export interface RecordLink {
  id: string;
  kind: SyncKind;
  localId: string;
  remoteId: string;
  remoteModifiedAt: Date | null;
  localSyncedAt: Date;
  dropped: boolean;
}

export interface LocalChange {
  id: string;
  watermark: Date;
}

export interface LocalLead {
  id: string;
  orgId: string;
  projectId: string;
  clientId: string;
  name: string;
  amount: string | null;
  source: string | null;
  notes: string | null;
  stageKey: string;
  personId: string | null;
  companyId: string | null;
  updatedAt: Date;
}

export interface LocalPerson {
  id: string;
  clientId: string;
  name: string;
  phone: string | null;
  email: string | null;
  companyId: string | null;
  updatedAt: Date;
}

export interface LocalCompany {
  id: string;
  clientId: string;
  name: string;
  phone: string | null;
  website: string | null;
  updatedAt: Date;
}

export interface LocalNote {
  id: string;
  leadId: string;
  body: string;
  authorName: string | null;
  watermark: Date;
}

export interface LocalTask {
  id: string;
  leadId: string;
  title: string;
  description: unknown;
  dueDate: Date | null;
  done: boolean;
  assigneeEmail: string | null;
  updatedAt: Date;
}

export interface LocalComment {
  id: string;
  taskId: string;
  body: string;
  authorName: string | null;
  watermark: Date;
}

export interface LeadWrite {
  name: string;
  amount: string | null;
  source: string | null;
  notes: string | null;
  personId: string | null;
  companyId: string | null;
  stageKey?: string;
}

export interface TaskWrite {
  title: string;
  dueDate: Date | null;
  done: boolean;
  assigneeId: string | null;
  description?: unknown;
}

export interface SyncStore {
  link(connectionId: string, kind: SyncKind, localId: string): Promise<RecordLink | null>;
  linkByRemote(connectionId: string, kind: SyncKind, remoteId: string): Promise<RecordLink | null>;
  saveLink(connectionId: string, link: { kind: SyncKind; localId: string; remoteId: string; remoteModifiedAt: Date | null; localSyncedAt: Date }): Promise<void>;
  dropLink(id: string): Promise<void>;
  fail(connectionId: string, kind: string, key: string, reason: string, failedFor: Date | null): Promise<void>;
  clear(connectionId: string, kind: string, key: string): Promise<void>;
  inbox(connectionId: string, limit: number): Promise<Array<{ id: string; kind: SyncKind; remoteId: string }>>;
  removeInbox(id: string): Promise<void>;
  changed(connection: { id: string; orgId: string; connectedAt: Date }, kind: SyncKind, options: { limit: number; unlinkedOnly: boolean; includeOld: boolean }): Promise<LocalChange[]>;
  advanceRun(runId: string, change: { created?: number; failed?: number; cursor?: Record<string, unknown>; state?: "DONE" | "FAILED" }): Promise<void>;
  runningRun(connectionId: string): Promise<RunRecord | null>;

  lead(id: string): Promise<LocalLead | null>;
  person(id: string): Promise<LocalPerson | null>;
  company(id: string): Promise<LocalCompany | null>;
  note(id: string): Promise<LocalNote | null>;
  task(id: string): Promise<LocalTask | null>;
  comment(id: string): Promise<LocalComment | null>;
  projectClient(projectId: string): Promise<string | null>;
  stageInProject(stageKey: string, projectId: string): Promise<boolean>;
  membershipByEmail(orgId: string, email: string): Promise<string | null>;

  createLead(orgId: string, projectId: string, write: LeadWrite & { stageKey: string }): Promise<{ id: string; updatedAt: Date }>;
  updateLead(id: string, write: LeadWrite): Promise<Date>;
  createPerson(orgId: string, clientId: string, write: { name: string; phone: string | null; email: string | null; companyId: string | null }): Promise<{ id: string; updatedAt: Date }>;
  updatePerson(id: string, write: { name: string; phone: string | null; email: string | null; companyId: string | null }): Promise<Date>;
  createCompany(orgId: string, clientId: string, write: { name: string; phone: string | null; website: string | null }): Promise<{ id: string; updatedAt: Date }>;
  updateCompany(id: string, write: { name: string; phone: string | null; website: string | null }): Promise<Date>;
  createNote(orgId: string, leadId: string, body: string): Promise<{ id: string; watermark: Date }>;
  updateNote(id: string, body: string): Promise<Date>;
  createTask(orgId: string, leadId: string, write: TaskWrite): Promise<{ id: string; updatedAt: Date }>;
  updateTask(id: string, write: TaskWrite): Promise<Date>;
  createComment(taskId: string, body: string): Promise<{ id: string; watermark: Date }>;
  updateComment(id: string, body: string): Promise<Date>;
}

export interface CrmAnnouncer {
  leadsChanged(orgId: string, projectId: string): void;
}
