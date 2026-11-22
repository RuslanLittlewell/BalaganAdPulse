import type { ActorContext, Clock, TransactionContext, UnitOfWork } from "#shared/application/index.js";
import type { TrustedAddressRecord, TwoFactorRecord } from "../domain/two-factor.js";

export interface Totp {
  newSecret(): string;
  verify(secret: string, code: string, now: Date, lastStep: number | null): number | null;
  uri(secret: string, account: string, issuer: string): string;
}

export interface QrRenderer {
  svg(text: string): Promise<string>;
}

export interface TwoFactorSecrets {
  seal(secret: string, userId: string): string;
  unseal(sealed: string, userId: string): string;
  hash(code: string): string;
  hashToken(token: string): string;
  newToken(): string;
  newBackupCodes(count: number): string[];
}

export interface TwoFactorStore {
  find(userId: string): Promise<TwoFactorRecord | null>;
  savePending(userId: string, sealedPending: string): Promise<void>;
  enable(userId: string, change: { sealedSecret: string; step: number; backupHashes: readonly string[]; address: string; now: Date }): Promise<void>;
  spendStep(userId: string, step: number): Promise<boolean>;
  spendBackupCode(userId: string, hash: string, now: Date): Promise<boolean>;
  replaceBackupCodes(userId: string, hashes: readonly string[]): Promise<void>;
  backupCodesLeft(userId: string): Promise<number>;
  remove(userId: string): Promise<void>;
  isTrusted(userId: string, address: string, now: Date): Promise<boolean>;
  trust(userId: string, address: string, now: Date): Promise<void>;
  addresses(userId: string): Promise<TrustedAddressRecord[]>;
  forget(userId: string, id: string): Promise<boolean>;
  forgetAll(userId: string): Promise<void>;
  openChallenge(tokenHash: string, userId: string, expiresAt: Date): Promise<void>;
  challenge(tokenHash: string, now: Date): Promise<{ userId: string } | null>;
  closeChallenge(tokenHash: string): Promise<void>;
  employeeRequirement(userId: string): Promise<boolean>;
  organizationRequirement(orgId: string): Promise<boolean>;
  setOrganizationRequirement(orgId: string, required: boolean): Promise<void>;
  enrolledMemberships(orgId: string): Promise<string[]>;
  memberOf(orgId: string, membershipId: string): Promise<{ userId: string; name: string } | null>;
  userByEmail(email: string): Promise<{ id: string; orgId: string | null } | null>;
  accountName(userId: string): Promise<string>;
}

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface SessionIssuer {
  completeSecondFactor(userId: string, verify: () => Promise<boolean>): Promise<TokenPair>;
  endSessions(userId: string): Promise<void>;
}

export interface PlatformAdministrators {
  isPlatformAdmin(userId: string): Promise<boolean>;
}

export interface TwoFactorAudit {
  record(context: TransactionContext, change: { membershipId: string; name: string }, actor: ActorContext): Promise<void>;
}

export interface TwoFactorDependencies {
  readonly store: TwoFactorStore;
  readonly totp: Totp;
  readonly qr: QrRenderer;
  readonly secrets: TwoFactorSecrets;
  readonly sessions: SessionIssuer;
  readonly platform: PlatformAdministrators;
  readonly audit: TwoFactorAudit;
  readonly clock: Clock;
  readonly unitOfWork: UnitOfWork;
}
