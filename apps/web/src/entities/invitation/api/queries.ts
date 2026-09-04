import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invitationsApi,
  type CreateInvitationInput,
  type RegistrationType,
} from "./api.js";

export const INVITATIONS_KEY = ["invitations"] as const;

export function useInvitations(registrationType?: RegistrationType) {
  return useQuery({
    queryKey: [...INVITATIONS_KEY, registrationType ?? null],
    queryFn: () => invitationsApi.list(registrationType),
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvitationInput) => invitationsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: invitationsApi.revoke,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}
