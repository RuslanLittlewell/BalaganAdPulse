import type { Role } from "@adpulse/access-policy";
import type {
  ActorContext,
  IdGenerator,
  TransactionContext,
  UnitOfWork,
} from "#shared/application/index.js";
import type { AuditWriter } from "#modules/audit/index.js";
import type { ClientAccountRecord } from "../domain/client-account.js";

export class LoginTakenError extends Error {
  constructor() {
    super("Login already exists");
    this.name = "LoginTakenError";
  }
}

export interface IssuedPassword {
  readonly passwordHash: string;
  readonly issuedPassword: string;
}

export interface ClientAccountRepository {
  findByClient(clientId: string): Promise<ClientAccountRecord | null>;
  createUser(
    context: TransactionContext,
    input: IssuedPassword & { id: string; name: string; login: string },
  ): Promise<void>;
  link(context: TransactionContext, clientId: string, membershipId: string): Promise<Date>;
  setPassword(context: TransactionContext, userId: string, password: IssuedPassword): Promise<void>;
  endSessions(context: TransactionContext, userId: string): Promise<void>;
}

export interface ClientAccountDirectory {
  findReachable(actor: ActorContext, clientId: string): Promise<{ id: string; name: string } | null>;
}

export interface ClientAccountEnrolment {
  enrol(context: TransactionContext, value: { userId: string; orgId: string; role: Role }): Promise<string>;
}

export interface ClientAccountGrant {
  grantClient(context: TransactionContext, membershipId: string, clientId: string): Promise<void>;
}

export interface CredentialGenerator {
  loginDigits(): string;
  password(): string;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
}

export interface PasswordCipher {
  seal(password: string, userId: string): string;
  open(sealed: string, userId: string): string;
}

export interface ClientAccountDependencies {
  readonly accounts: ClientAccountRepository;
  readonly clients: ClientAccountDirectory;
  readonly memberships: ClientAccountEnrolment;
  readonly access: ClientAccountGrant;
  readonly credentials: CredentialGenerator;
  readonly passwords: PasswordHasher;
  readonly cipher: PasswordCipher;
  readonly audit: AuditWriter;
  readonly ids: IdGenerator;
  readonly unitOfWork: UnitOfWork;
}
