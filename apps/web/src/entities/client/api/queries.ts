import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi, type ClientInput } from "./api.js";

const CLIENTS_KEY = ["clients"] as const;

export function useClients() {
  return useQuery({ queryKey: CLIENTS_KEY, queryFn: clientsApi.list });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientInput) => clientsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ClientInput }) => clientsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useSaveClientAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, png, avatarPath }: { id: string; png: Blob; avatarPath: string }) =>
      clientsApi.saveAvatar(id, png, avatarPath),
    // The stored URL carries a fresh version, so refetching the list is what
    // makes every avatar on screen reload rather than keep the cached picture.
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}
