import type { ActorContext, TransactionContext, UnitOfWork } from "#shared/application/index.js";
import type { AuditWriter } from "../../audit/index.js";
import type { Account, Integration } from "../domain/integration.js";

export interface CredentialCipher {
  encrypt(token: string, projectId: string): string;
  decrypt(value: string, projectId: string): string;
}
export interface AccountProvider {
  account(accountId: string, token: string, signal?: AbortSignal): Promise<Account>;
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
  clock: { now(): Date };
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}
