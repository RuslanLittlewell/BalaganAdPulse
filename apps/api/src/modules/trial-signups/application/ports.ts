import type { Clock, IdGenerator, TransactionContext, UnitOfWork } from "#shared/application/index.js";

export interface PendingTrialSignup {
  readonly id: string;
  readonly email: string;
  readonly organizationName: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface TrialSignupRepository {
  replace(context: TransactionContext, signup: PendingTrialSignup): Promise<void>;
  find(tokenHash: string): Promise<PendingTrialSignup | null>;
  consume(context: TransactionContext, tokenHash: string): Promise<boolean>;
}

export interface RegisteredEmails {
  isRegistered(email: string): Promise<boolean>;
}

export interface TrialTokens {
  generate(): string;
  hash(token: string): string;
  expiry(now: Date): Date;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
}

export interface TrialLinkDelivery {
  readonly available: boolean;
  deliver(recipient: { email: string; name: string; organizationName: string }, token: string): void;
}

export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface TrialProvisioning {
  provision(
    context: TransactionContext,
    value: { organizationName: string; name: string; email: string; passwordHash: string },
  ): Promise<SessionTokens>;
}

export interface TrialSignupDependencies {
  readonly signups: TrialSignupRepository;
  readonly emails: RegisteredEmails;
  readonly tokens: TrialTokens;
  readonly passwords: PasswordHasher;
  readonly links: TrialLinkDelivery;
  readonly provisioning: TrialProvisioning;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly unitOfWork: UnitOfWork;
}
