import { http } from "@/shared/lib/index.js";

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface SessionResponse {
  organization: Organization;
}

export const organizationApi = {
  get: async () => (await http.get<SessionResponse>("/auth/me")).organization,
};
