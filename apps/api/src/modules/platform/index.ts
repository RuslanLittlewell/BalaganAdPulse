export { createPlatformUseCases } from "./application/platform-use-cases.js";
export type { CreateOrganizationInput, PlatformUseCases } from "./application/platform-use-cases.js";
export type {
  FirstAdminInvitations,
  NewOrganization,
  OrganizationChange,
  OrganizationRegistry,
  PlatformAdministrators,
  PlatformDependencies,
  RegisteredAccounts,
} from "./application/ports.js";
export type { OrganizationRecord, OrganizationStatus } from "./domain/organization.js";
export { createPlatformRouter } from "./presentation/http/platform-http.js";
export { platformComponents, platformDoc } from "./presentation/http/platform-openapi.js";
