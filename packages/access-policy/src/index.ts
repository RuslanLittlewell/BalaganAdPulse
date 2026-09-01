/**
 * The role-to-permission matrix, stated once for the whole product.
 *
 * Two separate questions decide whether a request is allowed. This package
 * answers only the second one:
 *
 *   1. Which rows does this member reach?  Access grants, resolved in the API's
 *      scope helpers against the database.
 *   2. Which verbs may their role use?     This matrix, a pure function of the
 *      role.
 *
 * It is a workspace package rather than a module inside the API because the web
 * app renders from the same table. A control the UI offers that the API refuses
 * is a bug in one of two implementations; there is only one here.
 */

export const ROLES = ["ADMIN", "MANAGER", "GUEST", "CLIENT"] as const;
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

/** Who is asking. `can` reads only the role; the rest travels with it because
 * every caller that needs one needs the others too. */
export interface Actor {
  userId: string;
  membershipId: string;
  orgId: string;
  role: Role;
}

const EVERYONE: readonly Role[] = ROLES;
const STAFF: readonly Role[] = ["ADMIN", "MANAGER"];
const STAFF_AND_GUEST: readonly Role[] = ["ADMIN", "MANAGER", "GUEST"];
const ADMINS: readonly Role[] = ["ADMIN"];
const NOBODY: readonly Role[] = [];

type ResourcePolicy = Readonly<Record<Action, readonly Role[]>>;

/**
 * `read` is granted broadly on purpose: it says a role may read *the rows it
 * reaches*, and which rows those are is the grants' answer, not this table's. A
 * guest reading every client would need a grant for every client.
 */
const MATRIX: Readonly<Record<Resource, ResourcePolicy>> = {
  organization: { read: EVERYONE, create: NOBODY, update: ADMINS, delete: NOBODY },
  member: { read: ADMINS, create: ADMINS, update: ADMINS, delete: ADMINS },
  invite: { read: ADMINS, create: ADMINS, update: ADMINS, delete: ADMINS },
  client: { read: EVERYONE, create: STAFF, update: STAFF, delete: ADMINS },
  project: { read: EVERYONE, create: STAFF, update: STAFF, delete: ADMINS },
  // One resource for the whole hierarchy — the campaign, its ad sets, its ads
  // and their measured figures. Splitting it described the old sheet's
  // internals rather than anything a role has an opinion about.
  campaign: { read: EVERYONE, create: STAFF, update: STAFF, delete: STAFF },
  // The board is the agency's internal work: a customer does not reach it at
  // all, rather than seeing an empty one. The client portal is a later change
  // and will decide what they should see; closed is the safe default.
  task: { read: STAFF_AND_GUEST, create: STAFF, update: STAFF, delete: STAFF },
  // Append-only: the trail is read through the API and written only by the
  // services, inside the transaction of the mutation being recorded.
  audit: { read: EVERYONE, create: NOBODY, update: NOBODY, delete: NOBODY },
};

/**
 * Whether `actor`'s role permits `action` on `resource`.
 *
 * Fails closed: an action, resource or role outside the matrix is refused
 * rather than throwing, so a caller that drifts ahead of this table denies
 * access instead of returning a 500 — or, worse, allowing it.
 */
export function can(actor: Actor, action: Action, resource: Resource): boolean {
  if (!Object.hasOwn(MATRIX, resource)) return false;
  const policy = MATRIX[resource];
  if (!Object.hasOwn(policy, action)) return false;
  return policy[action].includes(actor.role);
}
