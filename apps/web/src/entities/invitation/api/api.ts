import type { Role } from "@adpulse/access-policy";
import { http } from "@/shared/lib/index.js";

export type InvitationStatus = "PENDING" | "USED" | "REVOKED" | "EXPIRED";

/** Which registration form the link opens. */
/**
 * What a link creates: a company and its first project, an agency employee, or
 * somebody joining a company that already exists.
 */
export type RegistrationType = "CLIENT" | "EMPLOYEE" | "CLIENT_STAFF";

/** The roles an employee invitation may grant. `CLIENT` is not among them: a
 * customer arrives through a client invitation, which carries no role. */
export const EMPLOYEE_ROLES = ["ADMIN", "MANAGER", "GUEST"] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export interface Invitation {
  id: string;
  code: string;
  registrationType: RegistrationType;
  /** Null on a client invitation. */
  role: Role | null;
  /** The projects an employee invitation grants on redemption. */
  projectIds: string[];
  email: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  status: InvitationStatus;
  /** Built by the backend, which owns the exact link format. */
  registrationUrl: string;
  createdAt: string;
}

interface CommonInvitationInput {
  email?: string | null;
  expiresInDays?: number;
}

/** A discriminated union rather than optional fields, so a client invitation
 * cannot be given a role by accident — the API refuses that, and the type
 * refuses it here first. */
export type CreateInvitationInput =
  | ({ registrationType: "CLIENT" } & CommonInvitationInput)
  | ({
      registrationType: "EMPLOYEE";
      role: EmployeeRole;
      projectIds: string[];
    } & CommonInvitationInput)
  // Joining a client that already exists: it names the client and nothing else.
  | ({ registrationType: "CLIENT_STAFF"; clientId: string } & CommonInvitationInput);

export const invitationsApi = {
  list: (registrationType?: RegistrationType) =>
    http.get<Invitation[]>(
      `/invites${registrationType ? `?registrationType=${registrationType}` : ""}`,
    ),
  create: (body: CreateInvitationInput) => http.post<Invitation>("/invites", body),
  revoke: (id: string) => http.del(`/invites/${id}`),
};
