import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { ReachedEvent } from '#modules/leads/index.js';
import type { DatasetJob, DeliveryCounts, DueSend, OutgoingEvent, RecentSend, StoredDataset } from '../domain/conversions.js';

export interface TokenCipher {
  encrypt(token: string, projectId: string): string;
  decrypt(value: string, projectId: string): string;
}

export interface ConversionsApi {
  dataset(datasetId: string, token: string, signal?: AbortSignal): Promise<{ id: string; name: string }>;
  send(datasetId: string, token: string, events: readonly OutgoingEvent[], testEventCode: string | null, signal?: AbortSignal): Promise<void>;
}

export interface ReachSource {
  reachedByChanges(context: TransactionContext, changeIds: readonly string[]): Promise<ReachedEvent[]>;
  reachedSince(context: TransactionContext, projectId: string, since: Date): Promise<ReachedEvent[]>;
}

export interface ProjectReach {
  findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string; budgetCurrency: string | null } | null>;
}

export interface DatasetInput {
  projectId: string;
  orgId: string;
  datasetId: string;
  datasetName: string;
  encryptedToken: string;
  testEventCode: string | null;
  currency: string;
  revision: string;
  tokenChanged: boolean;
}

export interface DatasetRepository {
  find(projectId: string, context?: TransactionContext): Promise<StoredDataset | null>;
  save(context: TransactionContext, input: DatasetInput): Promise<StoredDataset>;
  remove(context: TransactionContext, projectId: string): Promise<void>;
  timezone(projectId: string): Promise<string>;
  counts(projectId: string, timezone: string, today: string): Promise<DeliveryCounts>;
  recent(projectId: string, limit: number): Promise<RecentSend[]>;
}

export interface SendQueue {
  queue(context: TransactionContext, reached: readonly ReachedEvent[], now: Date): Promise<number>;
}

export interface ConversionJobs extends SendQueue {
  claimChanges(context: TransactionContext, limit: number): Promise<string[]>;
  markProcessed(context: TransactionContext, changeIds: readonly string[], now: Date): Promise<void>;
  expire(now: Date): Promise<number>;
  claim(now: Date): Promise<DatasetJob | null>;
  due(job: DatasetJob, now: Date, limit: number): Promise<DueSend[]>;
  sent(job: DatasetJob, sends: readonly { id: string; value: number | null; currency: string | null }[], now: Date): Promise<void>;
  refused(job: DatasetJob, sendId: string, reason: string, now: Date): Promise<void>;
  retry(job: DatasetJob, sendIds: readonly string[], reason: string, now: Date): Promise<void>;
  requireToken(job: DatasetJob, reason: string, now: Date): Promise<void>;
  release(job: DatasetJob): Promise<void>;
}
