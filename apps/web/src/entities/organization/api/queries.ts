import { useQuery } from "@tanstack/react-query";
import { organizationApi } from "./api.js";

export const ORGANIZATION_KEY = ["organization"] as const;

export function useOrganization() {
  return useQuery({ queryKey: ORGANIZATION_KEY, queryFn: organizationApi.get });
}
