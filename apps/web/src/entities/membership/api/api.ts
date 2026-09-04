import type { Role } from "@adpulse/access-policy";
import { http } from "@/shared/lib/index.js";

export type MembershipStatus = "ACTIVE" | "SUSPENDED";

export interface Membership {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
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
  list: () => http.get<Membership[]>("/members?kind=staff"),
  listOfClient: (clientId: string) =>
    http.get<Membership[]>(`/members?clientId=${clientId}`),
  update: (id: string, body: UpdateMemberInput) =>
    http.patch<Membership>(`/members/${id}`, body),
  remove: (id: string) => http.del(`/members/${id}`),
  setAccess: (id: string, grants: ClientAccessGrant[]) =>
    http.put<ClientAccessGrant[]>(`/members/${id}/access`, { grants }),
  access: (id: string) => http.get<ClientAccessGrant[]>(`/members/${id}/access`),
};
