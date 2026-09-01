import type {
  Clock,
  TransactionContext,
  UnitOfWork,
} from "../../../shared/application/index.js";
import type {
  IdentityUser,
  SessionPrincipal,
} from "../domain/identity-user.js";

export interface UserRepository {
  findByEmail(email: string): Promise<IdentityUser | null>;
  findById(id: string): Promise<IdentityUser | null>;
  create(
    context: TransactionContext,
    input: { name: string; email: string; passwordHash: string },
  ): Promise<IdentityUser>;
  update(
    context: TransactionContext,
    id: string,
    input: { name: string; passwordHash?: string },
  ): Promise<IdentityUser>;
  setAvatar(
    context: TransactionContext,
    id: string,
    input: { image: string; avatarPath: string },
  ): Promise<void>;
}

export interface InvitationRedemption {
  redeem(
    context: TransactionContext,
    code: string,
    email: string,
    userId: string,
    now: Date,
  ): Promise<void>;
}

export interface PasswordPort {
  readonly dummyHash: string;
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface TokenPort {
  issueAccess(principal: SessionPrincipal): Promise<string>;
  /** Throws for an expired, tampered or malformed token; the use case turns
   * every rejection into one indistinguishable refusal. */
  verifyAccess(token: string): Promise<SessionPrincipal>;
  generateRefresh(): string;
  hashRefresh(token: string): string;
  refreshExpiry(now: Date): Date;
}

export interface RefreshSessionRepository {
  save(
    context: TransactionContext,
    value: { userId: string; tokenHash: string; expiresAt: Date },
  ): Promise<void>;
  find(
    tokenHash: string,
  ): Promise<{ userId: string; expiresAt: Date; user: IdentityUser } | null>;
  revoke(context: TransactionContext, tokenHash: string): Promise<void>;
}

export interface ProfileStorage {
  readAvatar(userId: string): Promise<string | null>;
  writeAvatar(userId: string, png: Uint8Array): Promise<void>;
}

export interface IdentityDependencies {
  readonly users: UserRepository;
  readonly invitations: InvitationRedemption;
  readonly passwords: PasswordPort;
  readonly tokens: TokenPort;
  readonly sessions: RefreshSessionRepository;
  readonly profiles: ProfileStorage;
  readonly clock: Clock;
  readonly unitOfWork: UnitOfWork;
}
