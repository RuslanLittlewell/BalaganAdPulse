import type {
  ActorContext,
  IdGenerator,
  TransactionContext,
  UnitOfWork,
} from "#shared/application/index.js";
import type { AuditWriter } from "../../audit/index.js";
import type { ClientContact, ClientRecord, NewClient } from "../domain/client.js";

export interface ClientRepository {
  create(
    context: TransactionContext,
    input: NewClient & { id: string; orgId: string },
    grantTo: string | undefined,
  ): Promise<ClientRecord>;
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
