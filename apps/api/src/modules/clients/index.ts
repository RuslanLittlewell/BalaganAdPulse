export { createClientUseCases } from "./application/client-use-cases.js";
export type { ClientUseCases } from "./application/client-use-cases.js";
export type {
  ClientDependencies,
  ClientPictureStorage,
  ClientRepository,
} from "./application/ports.js";
export type { ClientContact, ClientRecord, NewClient } from "./domain/client.js";
export { createClientRouter } from "./presentation/http/client-http.js";
