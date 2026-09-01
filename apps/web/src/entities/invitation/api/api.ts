import type { Role } from "@adpulse/access-policy";
import { http } from "@/shared/lib/index.js";

export type InvitationStatus = "PENDING" | "USED" | "REVOKED" | "EXPIRED";

export interface Invitation {
  id: string;
  code: string;
  role: Role;
  email: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  status: InvitationStatus;
  createdAt: string;
}

export interface CreateInvitationInput {
  role: Role;
  email?: string | null;
  expiresInDays?: number;
}

export const invitationsApi = {
  list: () => http.get<Invitation[]>("/invites"),
  create: (body: CreateInvitationInput) => http.post<Invitation>("/invites", body),
  revoke: (id: string) => http.del(`/invites/${id}`),
};
