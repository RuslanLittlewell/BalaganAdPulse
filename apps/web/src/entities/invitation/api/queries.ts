import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invitationsApi,
  type CreateInvitationInput,
  type RegistrationType,
} from "./api.js";

export const INVITATIONS_KEY = ["invitations"] as const;

/**
 * The organization's pending invitations, optionally of one registration type.
 *
 * The type is part of the key: the contact book can show a client pane and an
 * employee pane at once, and one must not be served the other's answer.
 */
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
    // A refetch rather than a local filter: the backend keeps the row as
    // history and drops it from the ordinary list, so the list it answers with
    // is the definition of what is still actionable.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}
