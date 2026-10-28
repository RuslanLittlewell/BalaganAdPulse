export { createClientAccountUseCases } from "./application/client-account-use-cases.js";
export type { ClientAccountUseCases } from "./application/client-account-use-cases.js";
export type {
  ClientAccountDependencies,
  ClientAccountRepository,
  CredentialGenerator,
  PasswordCipher,
} from "./application/ports.js";
export { LoginTakenError } from "./application/ports.js";
export type { ClientAccountRecord, ClientCredentials } from "./domain/client-account.js";
export { loginPrefix } from "./domain/client-account.js";
export { createClientAccountRouter } from "./presentation/http/client-account-http.js";
export { clientAccountComponents, clientAccountDoc } from "./presentation/http/client-account-openapi.js";
