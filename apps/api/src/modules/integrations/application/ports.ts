import type { ActorContext, TransactionContext, UnitOfWork } from "#shared/application/index.js";
import type { AuditWriter } from "#modules/audit/index.js";
import type { LeadDelivery } from "#modules/leads/index.js";
import type { Account, Integration } from "../domain/integration.js";
import type { CreativeKind, CreativeView, ImportedCreative, StoredCreative } from "../domain/snapshot.js";

export interface CredentialCipher {
  encrypt(token: string, projectId: string): string;
  decrypt(value: string, projectId: string): string;
}
export interface AccountProvider {
  account(accountId: string, token: string, signal?: AbortSignal): Promise<Account>;
  preview(adExternalId: string, token: string, signal?: AbortSignal): Promise<string | null>;
  adCreatives(
    adExternalId: string,
    token: string,
    accountId?: string,
    signal?: AbortSignal,
  ): Promise<readonly ImportedCreative[]>;
}

export interface CreativeStore {
  list(adId: string): Promise<CreativeView[]>;
  outdated(adId: string): Promise<boolean>;
  save(adId: string, creatives: readonly StoredCreative[]): Promise<CreativeView[]>;
}

export interface AdLocator {
  locate(
    actor: ActorContext,
    adId: string,
  ): Promise<{ projectId: string; externalId: string | null; accountId: string | null } | null>;
}
export interface StoredFile {
  readonly key: string;
  readonly contentType: string;
  readonly bytes: number;
}
export interface CreativeFiles {
  copy(url: string, kind: CreativeKind, signal?: AbortSignal): Promise<StoredFile | null>;
}
export interface LeadInbox {
  deliver(context: TransactionContext, delivery: LeadDelivery): Promise<{ created: number }>;
  announce(target: { orgId: string; projectId: string }): void;
  link(projectId: string): Promise<void>;
}
export type ConnectionData = Account & { projectId: string; encryptedToken: string; nextDailyAt: Date; queuedAt: Date; leadsEnabled?: boolean };
export interface IntegrationRepository {
  list(projectId: string): Promise<Integration[]>;
  read(projectId: string, id: string): Promise<Integration | null>;
  add(context: TransactionContext, data: ConnectionData, now: Date): Promise<Integration>;
  replace(context: TransactionContext, id: string, data: ConnectionData, now: Date): Promise<Integration>;
  remove(context: TransactionContext, id: string): Promise<void>;
  queue(id: string, now: Date): Promise<void>;
  setLeadsEnabled(id: string, enabled: boolean, now: Date): Promise<void>;
  holdsFigures(projectId: string): Promise<boolean>;
  adoptCurrency(context: TransactionContext, projectId: string, currency: string): Promise<void>;
}
export interface IntegrationDependencies {
  repository: IntegrationRepository;
  provider: AccountProvider;
  cipher: CredentialCipher;
  projects: { findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string; budgetCurrency: string | null } | null> };
  ads: AdLocator;
  creatives: CreativeStore;
  files: CreativeFiles;
  clock: { now(): Date };
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}
