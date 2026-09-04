export const ROLES = ["ADMIN", "MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = ["read", "create", "update", "delete"] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  "organization",
  "member",
  "invite",
  "client",
  "project",
  "campaign",
  "task",
  "audit",
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
const STAFF: readonly Role[] = ["ADMIN", "MANAGER"];
const STAFF_AND_GUEST: readonly Role[] = ["ADMIN", "MANAGER", "GUEST"];
const STAFF_AND_CUSTOMERS: readonly Role[] = ["ADMIN", "MANAGER", ...CUSTOMERS];
const ADMINS: readonly Role[] = ["ADMIN"];
const ADMINS_AND_PRINCIPAL: readonly Role[] = ["ADMIN", "CLIENT_ADMIN"];
const NOBODY: readonly Role[] = [];

type ResourcePolicy = Readonly<Record<Action, readonly Role[]>>;

const MATRIX: Readonly<Record<Resource, ResourcePolicy>> = {
  organization: { read: EVERYONE, create: NOBODY, update: ADMINS, delete: NOBODY },
  member: { read: ADMINS_AND_PRINCIPAL, create: ADMINS, update: ADMINS, delete: ADMINS_AND_PRINCIPAL },
  invite: {
    read: ADMINS_AND_PRINCIPAL,
    create: ADMINS_AND_PRINCIPAL,
    update: ADMINS,
    delete: ADMINS_AND_PRINCIPAL,
  },
  client: { read: EVERYONE, create: STAFF, update: STAFF, delete: ADMINS },
  project: { read: EVERYONE, create: STAFF, update: STAFF, delete: ADMINS },
  campaign: { read: EVERYONE, create: STAFF, update: STAFF, delete: STAFF },
  task: { read: EVERYONE, create: STAFF_AND_CUSTOMERS, update: STAFF, delete: STAFF },
  audit: { read: EVERYONE, create: NOBODY, update: NOBODY, delete: NOBODY },
};

export function can(actor: Actor, action: Action, resource: Resource): boolean {
  if (!Object.hasOwn(MATRIX, resource)) return false;
  const policy = MATRIX[resource];
  if (!Object.hasOwn(policy, action)) return false;
  return policy[action].includes(actor.role);
}
