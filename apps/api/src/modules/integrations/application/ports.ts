import type { ActorContext, TransactionContext, UnitOfWork } from "#shared/application/index.js";
import type { AuditWriter } from "../../audit/index.js";
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
  save(adId: string, creatives: readonly StoredCreative[]): Promise<CreativeView[]>;
}

export interface AdLocator {
  locate(
    actor: ActorContext,
    adId: string,
  ): Promise<{ projectId: string; externalId: string | null } | null>;
}
export interface StoredFile {
  readonly key: string;
  readonly contentType: string;
  readonly bytes: number;
}
export interface CreativeFiles {
  copy(url: string, kind: CreativeKind, signal?: AbortSignal): Promise<StoredFile | null>;
}
export interface IntegrationRepository {
  read(projectId: string): Promise<Integration | null>;
  save(context: TransactionContext, data: Account & { projectId: string; encryptedToken: string; nextDailyAt: Date; queuedAt: Date }): Promise<Integration>;
  remove(context: TransactionContext, projectId: string): Promise<void>;
  queue(projectId: string, now: Date): Promise<void>;
}
export interface IntegrationDependencies {
  repository: IntegrationRepository;
  provider: AccountProvider;
  cipher: CredentialCipher;
  projects: { findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string; budgetCurrency: string } | null> };
  ads: AdLocator;
  creatives: CreativeStore;
  files: CreativeFiles;
  clock: { now(): Date };
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}
