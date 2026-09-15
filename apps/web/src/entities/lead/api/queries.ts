import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyLeadMove } from "../lib/ordering.js";
import { leadsApi, type CountingPeriod, type Lead, type LeadColumn, type LeadColumnInput, type LeadInput, type LeadMove } from "./api.js";

export const BOARDS_KEY = ["crm", "boards"] as const;

export const leadsKey = (boardKey: string) => ["crm", "leads", boardKey] as const;

export const leadColumnsKey = (boardKey: string) => ["crm", "columns", boardKey] as const;

export function useLeadBoards() {
  return useQuery({ queryKey: BOARDS_KEY, queryFn: () => leadsApi.boards() });
}

export function useLeads(boardKey: string | undefined) {
  return useQuery({
    queryKey: leadsKey(boardKey ?? ""),
    queryFn: () => leadsApi.list(boardKey!),
    enabled: Boolean(boardKey),
  });
}

export function useProjectStageCounts({ from, to }: CountingPeriod) {
  return useQuery({
    queryKey: ["crm", "project-stage-counts", { from, to }],
    queryFn: () => leadsApi.projectStageCounts({ from, to }),
  });
}

export function useLeadColumns(boardKey: string | undefined) {
  return useQuery({
    queryKey: leadColumnsKey(boardKey ?? ""),
    queryFn: () => leadsApi.columns(boardKey!),
    enabled: Boolean(boardKey),
  });
}

export function useCreateLeadColumn(boardKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => leadsApi.createColumn(boardKey, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadColumnsKey(boardKey) }),
  });
}

export function useUpdateLeadColumn(boardKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: LeadColumnInput }) =>
      leadsApi.updateColumn(boardKey, id, body),
    onSuccess: (columns) => qc.setQueryData<LeadColumn[]>(leadColumnsKey(boardKey), columns),
  });
}

export function useDeleteLeadColumn(boardKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadsApi.removeColumn(boardKey, id),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: leadColumnsKey(boardKey) }),
      qc.invalidateQueries({ queryKey: leadsKey(boardKey) }),
    ]),
  });
}

export function useCreateLead(boardKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LeadInput) => leadsApi.create(boardKey, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadsKey(boardKey) }),
  });
}

export function useUpdateLead(boardKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: LeadInput }) =>
      leadsApi.update(boardKey, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadsKey(boardKey) }),
  });
}

export function useDeleteLead(boardKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadsApi.remove(boardKey, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadsKey(boardKey) }),
  });
}

export function useMoveLead(boardKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: LeadMove }) =>
      leadsApi.move(boardKey, id, body),
    onMutate: async ({ id, body }) => {
      const key = leadsKey(boardKey);
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<Lead[]>(key);
      if (snapshot) qc.setQueryData<Lead[]>(key, applyLeadMove(snapshot, id, body));
      return { snapshot };
    },
    onSuccess: (board) => qc.setQueryData<Lead[]>(leadsKey(boardKey), board),
    onError: (_error, _variables, context) => {
      if (context?.snapshot) qc.setQueryData<Lead[]>(leadsKey(boardKey), context.snapshot);
      void qc.invalidateQueries({ queryKey: leadsKey(boardKey) });
    },
  });
}
