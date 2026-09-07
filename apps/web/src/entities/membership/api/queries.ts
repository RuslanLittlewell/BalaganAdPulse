import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  membersApi,
  type ClientAccessGrant,
  type UpdateMemberInput,
} from "./api.js";

export const MEMBERS_KEY = ["members"] as const;

export function useClientMembers(clientId: string | undefined) {
  return useQuery({
    queryKey: [...MEMBERS_KEY, "client", clientId ?? null],
    queryFn: () => membersApi.listOfClient(clientId as string),
    enabled: clientId != null,
  });
}

export function useMemberAccess(membershipId: string | undefined) {
  return useQuery({
    queryKey: [...MEMBERS_KEY, "access", membershipId ?? null],
    queryFn: () => membersApi.access(membershipId as string),
    enabled: membershipId != null,
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMemberInput }) =>
      membersApi.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: membersApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}

export function useSetMemberAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, grants }: { id: string; grants: ClientAccessGrant[] }) =>
      membersApi.setAccess(id, grants),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}
