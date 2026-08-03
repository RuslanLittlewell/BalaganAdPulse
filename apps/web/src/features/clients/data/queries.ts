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
