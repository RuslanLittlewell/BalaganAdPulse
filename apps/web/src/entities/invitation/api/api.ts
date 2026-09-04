import type { Role } from "@adpulse/access-policy";
import { http } from "@/shared/lib/index.js";

export type InvitationStatus = "PENDING" | "USED" | "REVOKED" | "EXPIRED";

export type RegistrationType = "CLIENT" | "EMPLOYEE" | "CLIENT_STAFF";

export const EMPLOYEE_ROLES = ["ADMIN", "MANAGER", "GUEST"] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export interface Invitation {
  id: string;
  code: string;
  registrationType: RegistrationType;
  role: Role | null;
  projectIds: string[];
  email: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  status: InvitationStatus;
  registrationUrl: string;
  createdAt: string;
}

interface CommonInvitationInput {
  email?: string | null;
  expiresInDays?: number;
}

export type CreateInvitationInput =
  | ({ registrationType: "CLIENT" } & CommonInvitationInput)
  | ({
      registrationType: "EMPLOYEE";
      role: EmployeeRole;
      projectIds: string[];
    } & CommonInvitationInput)
  | ({ registrationType: "CLIENT_STAFF"; clientId: string } & CommonInvitationInput);

export const invitationsApi = {
  list: (registrationType?: RegistrationType) =>
    http.get<Invitation[]>(
      `/invites${registrationType ? `?registrationType=${registrationType}` : ""}`,
    ),
  create: (body: CreateInvitationInput) => http.post<Invitation>("/invites", body),
  revoke: (id: string) => http.del(`/invites/${id}`),
};
