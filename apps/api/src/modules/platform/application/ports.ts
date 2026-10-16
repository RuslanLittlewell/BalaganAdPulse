import type { OptionalModule } from "@adpulse/access-policy";
import type { Clock, IdGenerator, TransactionContext, UnitOfWork } from "#shared/application/index.js";
import type { OrganizationRecord, OrganizationStatus } from "../domain/organization.js";

export interface NewOrganization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly modules: readonly OptionalModule[];
}

export interface OrganizationChange {
  readonly name?: string;
  readonly modules?: readonly OptionalModule[];
  readonly status?: OrganizationStatus;
}

export interface OrganizationRegistry {
  list(): Promise<OrganizationRecord[]>;
  findById(id: string): Promise<OrganizationRecord | null>;
  slugsStartingWith(base: string): Promise<string[]>;
  create(context: TransactionContext, input: NewOrganization): Promise<void>;
  update(context: TransactionContext, id: string, change: OrganizationChange): Promise<void>;
  delete(context: TransactionContext, id: string): Promise<void>;
}

export interface PlatformAdministrators {
  isPlatformAdmin(userId: string): Promise<boolean>;
}

export interface RegisteredAccounts {
  isRegistered(email: string): Promise<boolean>;
}

export interface FirstAdminInvitations {
  issue(context: TransactionContext, value: { orgId: string; email: string }): Promise<{ code: string }>;
}

export interface PlatformDependencies {
  readonly organizations: OrganizationRegistry;
  readonly administrators: PlatformAdministrators;
  readonly accounts: RegisteredAccounts;
  readonly invitations: FirstAdminInvitations;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly unitOfWork: UnitOfWork;
}
