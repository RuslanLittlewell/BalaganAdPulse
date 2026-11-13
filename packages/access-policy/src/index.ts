export const ROLES = ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN", "PARTNER"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = ["read", "create", "update", "delete"] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  "organization",
  "member",
  "invite",
  "client",
  "client-account",
  "project",
  "campaign",
  "task",
  "audit",
  "lead",
  "integration",
  "kpi",
  "project-summary",
  "project-document",
  "report",
  "share-link",
  "lead-board",
  "partner",
] as const;
export type Resource = (typeof RESOURCES)[number];

export interface Actor {
  userId: string;
  membershipId: string;
  orgId: string;
  role: Role;
}

const CUSTOMERS: readonly Role[] = ["CLIENT", "CLIENT_ADMIN"];

export function isCustomer(role: Role): boolean {
  return CUSTOMERS.includes(role);
}

const EVERYONE: readonly Role[] = ROLES;
const MEMBERS: readonly Role[] = ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"];
const WORKING_LEADS: readonly Role[] = ["ADMIN", "MANAGER", "CLIENT", "CLIENT_ADMIN", "PARTNER"];
const STAFF: readonly Role[] = ["ADMIN", "MANAGER"];
const STAFF_AND_GUEST: readonly Role[] = ["ADMIN", "MANAGER", "GUEST"];
const STAFF_AND_CUSTOMERS: readonly Role[] = ["ADMIN", "MANAGER", ...CUSTOMERS];
const ADMINS: readonly Role[] = ["ADMIN"];
const ADMINS_AND_PRINCIPAL: readonly Role[] = ["ADMIN", "CLIENT_ADMIN"];
const NOBODY: readonly Role[] = [];

type ResourcePolicy = Readonly<Record<Action, readonly Role[]>>;

const MATRIX: Readonly<Record<Resource, ResourcePolicy>> = {
  lead: { read: EVERYONE, create: WORKING_LEADS, update: WORKING_LEADS, delete: STAFF_AND_CUSTOMERS },
  "lead-board": { read: EVERYONE, create: STAFF_AND_CUSTOMERS, update: STAFF_AND_CUSTOMERS, delete: STAFF_AND_CUSTOMERS },
  partner: { read: ADMINS_AND_PRINCIPAL, create: ADMINS_AND_PRINCIPAL, update: ADMINS_AND_PRINCIPAL, delete: ADMINS_AND_PRINCIPAL },
  organization: { read: EVERYONE, create: NOBODY, update: ADMINS, delete: NOBODY },
  member: { read: ADMINS_AND_PRINCIPAL, create: ADMINS, update: ADMINS, delete: ADMINS_AND_PRINCIPAL },
  invite: {
    read: ADMINS_AND_PRINCIPAL,
    create: ADMINS_AND_PRINCIPAL,
    update: ADMINS,
    delete: ADMINS_AND_PRINCIPAL,
  },
  client: { read: MEMBERS, create: STAFF, update: STAFF, delete: ADMINS },
  "client-account": { read: ADMINS, create: ADMINS, update: ADMINS, delete: NOBODY },
  project: { read: EVERYONE, create: STAFF_AND_CUSTOMERS, update: STAFF_AND_CUSTOMERS, delete: ADMINS },
  "project-summary": { read: EVERYONE, create: NOBODY, update: STAFF, delete: NOBODY },
  "project-document": { read: STAFF_AND_GUEST, create: STAFF, update: STAFF, delete: STAFF },
  integration: { read: STAFF, create: STAFF, update: STAFF, delete: STAFF },
  kpi: { read: MEMBERS, create: STAFF, update: STAFF, delete: STAFF },
  report: { read: MEMBERS, create: STAFF, update: STAFF, delete: STAFF },
  campaign: { read: EVERYONE, create: STAFF, update: STAFF, delete: STAFF },
  task: { read: MEMBERS, create: STAFF_AND_CUSTOMERS, update: STAFF, delete: STAFF },
  audit: { read: MEMBERS, create: NOBODY, update: NOBODY, delete: NOBODY },
  "share-link": { read: ADMINS, create: ADMINS, update: ADMINS, delete: ADMINS },
};

export function can(actor: Actor, action: Action, resource: Resource): boolean {
  if (!Object.hasOwn(MATRIX, resource)) return false;
  const policy = MATRIX[resource];
  if (!Object.hasOwn(policy, action)) return false;
  return policy[action].includes(actor.role);
}

export const ALWAYS_ON_MODULES = ["DASHBOARD", "PROJECTS"] as const;
export const OPTIONAL_MODULES = ["CRM", "TASKS", "REPORTS"] as const;
export const MODULES = [...ALWAYS_ON_MODULES, ...OPTIONAL_MODULES] as const;
export type OptionalModule = (typeof OPTIONAL_MODULES)[number];
export type ModuleKey = (typeof MODULES)[number];

export function isOptionalModule(value: string): value is OptionalModule {
  return (OPTIONAL_MODULES as readonly string[]).includes(value);
}

export function enabledModules(optional: readonly OptionalModule[]): ModuleKey[] {
  return MODULES.filter((module) => !isOptionalModule(module) || optional.includes(module));
}

export const TARIFFS = ["TRIAL", "SOLO", "BUSINESS", "AGENCY", "AGENCY_PRO", "ENTERPRISE"] as const;
export type Tariff = (typeof TARIFFS)[number];

export const LIMITED_RESOURCES = ["projects", "clients", "users", "adAccounts"] as const;
export type LimitedResource = (typeof LIMITED_RESOURCES)[number];

export function isLimitedResource(value: string): value is LimitedResource {
  return (LIMITED_RESOURCES as readonly string[]).includes(value);
}

export type TariffLimits = Readonly<Record<LimitedResource, number | null>>;

export interface TariffPlan {
  readonly limits: TariffLimits;
  readonly modules: readonly OptionalModule[];
}

export const TRIAL_DAYS = 14;
export const DEFAULT_TARIFF: Tariff = "TRIAL";

const ALL_OPTIONAL: readonly OptionalModule[] = OPTIONAL_MODULES;

const AGENCY_LIMITS: TariffLimits = { projects: 15, clients: 15, users: 5, adAccounts: null };

export const TARIFF_PLANS: Readonly<Record<Tariff, TariffPlan>> = {
  TRIAL: { limits: AGENCY_LIMITS, modules: ALL_OPTIONAL },
  SOLO: { limits: { projects: 5, clients: null, users: 1, adAccounts: null }, modules: [] },
  BUSINESS: { limits: { projects: null, clients: 1, users: 3, adAccounts: 3 }, modules: ["CRM"] },
  AGENCY: { limits: AGENCY_LIMITS, modules: ALL_OPTIONAL },
  AGENCY_PRO: { limits: { projects: 40, clients: 40, users: 15, adAccounts: null }, modules: ALL_OPTIONAL },
  ENTERPRISE: { limits: { projects: null, clients: null, users: null, adAccounts: null }, modules: ALL_OPTIONAL },
};

export function isTariff(value: string): value is Tariff {
  return (TARIFFS as readonly string[]).includes(value);
}

export function tariffModules(tariff: Tariff): readonly OptionalModule[] {
  return TARIFF_PLANS[tariff].modules;
}

export function tariffsWithModule(module: OptionalModule): Tariff[] {
  return TARIFFS.filter((tariff) => TARIFF_PLANS[tariff].modules.includes(module));
}

export function trialEndsAtFrom(start: Date): Date {
  return new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export function isTrialExpired(organization: { tariff: Tariff; trialEndsAt: Date | null }, now: Date): boolean {
  return organization.tariff === "TRIAL" && organization.trialEndsAt !== null
    && organization.trialEndsAt.getTime() <= now.getTime();
}
