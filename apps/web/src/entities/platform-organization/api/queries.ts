import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  platformOrganizationsApi,
  type CreateOrganizationInput,
  type OrganizationChange,
} from "./api.js";

export const PLATFORM_ORGANIZATIONS_KEY = ["platform", "organizations"] as const;

export function usePlatformOrganizations() {
  return useQuery({ queryKey: PLATFORM_ORGANIZATIONS_KEY, queryFn: platformOrganizationsApi.list });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganizationInput) => platformOrganizationsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_ORGANIZATIONS_KEY }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: OrganizationChange }) =>
      platformOrganizationsApi.update(id, change),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_ORGANIZATIONS_KEY }),
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => platformOrganizationsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_ORGANIZATIONS_KEY }),
  });
}
