import type { ModuleKey, OptionalModule } from "@adpulse/access-policy";
import { http } from "@/shared/lib/index.js";

export type PlatformOrganizationStatus = "ACTIVE" | "SUSPENDED";
export type FirstAdminState = "PENDING" | "ACCEPTED";

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  status: PlatformOrganizationStatus;
  modules: ModuleKey[];
  activeMembers: number;
  createdAt: string;
  firstAdmin: {
    email: string | null;
    state: FirstAdminState;
    registrationUrl: string | null;
  } | null;
}

export interface CreateOrganizationInput {
  name: string;
  modules: OptionalModule[];
  adminEmail: string;
}

export interface CreatedOrganization {
  organization: PlatformOrganization;
  registrationUrl: string;
}

export interface OrganizationChange {
  name?: string;
  modules?: OptionalModule[];
  status?: PlatformOrganizationStatus;
}

const ORGANIZATIONS = "/platform/organizations";

export const platformOrganizationsApi = {
  list: () => http.get<PlatformOrganization[]>(ORGANIZATIONS),
  create: (body: CreateOrganizationInput) => http.post<CreatedOrganization>(ORGANIZATIONS, body),
  update: (id: string, change: OrganizationChange) =>
    http.patch<PlatformOrganization>(`${ORGANIZATIONS}/${encodeURIComponent(id)}`, change),
  remove: (id: string) => http.del(`${ORGANIZATIONS}/${encodeURIComponent(id)}`),
};
