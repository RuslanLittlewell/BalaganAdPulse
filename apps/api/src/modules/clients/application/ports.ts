import type {
  ActorContext,
  IdGenerator,
  TransactionContext,
  UnitOfWork,
} from "../../../shared/application/index.js";
import type { AuditWriter } from "../../audit/index.js";
import type { ClientContact, ClientRecord, NewClient } from "../domain/client.js";

export interface ClientRepository {
  /** `grantTo` is the membership that should be able to reach the new client,
   * or undefined when the creator's role already reaches everything. */
  create(
    context: TransactionContext,
    input: NewClient & { id: string; orgId: string },
    grantTo: string | undefined,
  ): Promise<ClientRecord>;
  /** Reach is translated here: the actor's role and grants become the query's
   * filter, so no use case has to know how tenancy is stored. */
  listReachable(actor: ActorContext): Promise<ClientRecord[]>;
  findReachable(actor: ActorContext, id: string): Promise<ClientRecord | null>;
  update(context: TransactionContext, id: string, input: ClientContact): Promise<ClientRecord>;
  delete(context: TransactionContext, id: string): Promise<void>;
  reachableIds(actor: ActorContext): Promise<string[]>;
}

export interface ClientPictureStorage {
  read(clientId: string): Promise<Uint8Array | null>;
  write(clientId: string, png: Uint8Array): Promise<void>;
}

export interface ClientDependencies {
  readonly clients: ClientRepository;
  readonly pictures: ClientPictureStorage;
  readonly audit: AuditWriter;
  readonly ids: IdGenerator;
  readonly unitOfWork: UnitOfWork;
}
