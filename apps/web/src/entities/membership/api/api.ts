import type { Role } from "@adpulse/access-policy";
import { http } from "@/shared/lib/index.js";

export type MembershipStatus = "ACTIVE" | "SUSPENDED";

export interface Membership {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  /** How to reach them. The person's own, and never required. */
  phone: string | null;
  telegram: string | null;
  role: Role;
  status: MembershipStatus;
  createdAt: string;
}

export interface UpdateMemberInput {
  role?: Role;
  status?: MembershipStatus;
}

export interface ClientAccessGrant {
  id?: string;
  clientId: string;
  projectId?: string | null;
}

export const membersApi = {
  /** The agency's own people. Everywhere colleagues are shown means staff — the
   * employee directory, the assignee select, the name on a card — and a
   * customer holds a membership too. */
  list: () => http.get<Membership[]>("/members?kind=staff"),
  /** A client's own people — the customers granted it, whichever role they
   * hold. A different question from the agency's staff, at the same address. */
  listOfClient: (clientId: string) =>
    http.get<Membership[]>(`/members?clientId=${clientId}`),
  update: (id: string, body: UpdateMemberInput) =>
    http.patch<Membership>(`/members/${id}`, body),
  remove: (id: string) => http.del(`/members/${id}`),
  setAccess: (id: string, grants: ClientAccessGrant[]) =>
    http.put<ClientAccessGrant[]>(`/members/${id}/access`, { grants }),
  /** What a membership reaches now. The screen that changes access has to show
   * what it is changing. */
  access: (id: string) => http.get<ClientAccessGrant[]>(`/members/${id}/access`),
};
