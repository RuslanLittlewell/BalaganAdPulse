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

/** Who is asking. `can` reads only the role; the rest travels with it because
 * every caller that needs one needs the others too. */
export interface Actor {
  userId: string;
  membershipId: string;
  orgId: string;
  role: Role;
}

/**
 * The roles on the customer's side of the relationship.
 *
 * Stated once, and asked through `isCustomer` rather than compared by name at
 * each site: the two differ only in whether they administer their own company's
 * people, and every other rule about them — what they reach, which tasks they
 * see, that they are not the agency's staff — is the same for both. Comparing
 * names is how a second customer role silently turned up among the employees.
 */
const CUSTOMERS: readonly Role[] = ["CLIENT", "CLIENT_ADMIN"];

/** Whether this role belongs to a customer rather than to the agency. */
export function isCustomer(role: Role): boolean {
  return CUSTOMERS.includes(role);
}

const EVERYONE: readonly Role[] = ROLES;
const STAFF: readonly Role[] = ["ADMIN", "MANAGER"];
const STAFF_AND_GUEST: readonly Role[] = ["ADMIN", "MANAGER", "GUEST"];
const STAFF_AND_CUSTOMERS: readonly Role[] = ["ADMIN", "MANAGER", ...CUSTOMERS];
const ADMINS: readonly Role[] = ["ADMIN"];
/** The agency's admins, and the principal on a customer's own company. Which
 * people each of them reaches is the grants' answer, not this table's. */
const ADMINS_AND_PRINCIPAL: readonly Role[] = ["ADMIN", "CLIENT_ADMIN"];
const NOBODY: readonly Role[] = [];

type ResourcePolicy = Readonly<Record<Action, readonly Role[]>>;

/**
 * `read` is granted broadly on purpose: it says a role may read *the rows it
 * reaches*, and which rows those are is the grants' answer, not this table's. A
 * guest reading every client would need a grant for every client.
 */
const MATRIX: Readonly<Record<Resource, ResourcePolicy>> = {
  organization: { read: EVERYONE, create: NOBODY, update: ADMINS, delete: NOBODY },
  // The principal administers its own company's people: it sees them and can
  // remove one. Creating a membership and changing a role stay with the agency —
  // somebody joins by redeeming an invitation, not by being conjured.
  member: { read: ADMINS_AND_PRINCIPAL, create: ADMINS, update: ADMINS, delete: ADMINS_AND_PRINCIPAL },
  // Issued by either side. Whose invitations a caller may see, make or revoke is
  // the grants' answer: the agency's admins reach every client, a principal
  // reaches only its own.
  invite: {
    read: ADMINS_AND_PRINCIPAL,
    create: ADMINS_AND_PRINCIPAL,
    update: ADMINS,
    delete: ADMINS_AND_PRINCIPAL,
  },
  client: { read: EVERYONE, create: STAFF, update: STAFF, delete: ADMINS },
  project: { read: EVERYONE, create: STAFF, update: STAFF, delete: ADMINS },
  // One resource for the whole hierarchy — the campaign, its ad sets, its ads
  // and their measured figures. Splitting it described the old sheet's
  // internals rather than anything a role has an opinion about.
  campaign: { read: EVERYONE, create: STAFF, update: STAFF, delete: STAFF },
  // A customer reads the board and may raise a request on it, then leaves it
  // alone: changing or withdrawing one is the agency's to do. What either side
  // *sees* is reach's answer rather than this table's — a customer reaches only
  // the tasks marked as shown to them, and a manager only the ones they are
  // responsible for.
  task: { read: EVERYONE, create: STAFF_AND_CUSTOMERS, update: STAFF, delete: STAFF },
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
