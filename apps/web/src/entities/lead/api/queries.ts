import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyLeadMove } from "../lib/ordering.js";
import { leadsApi, type CountingPeriod, type Lead, type LeadColumn, type LeadColumnInput, type LeadInput, type LeadMove } from "./api.js";

export const leadActivityKey = (boardKey: string, leadId?: string) =>
  (leadId ? ["crm", "lead-activity", boardKey, leadId] : ["crm", "lead-activity", boardKey]) as readonly string[];

export const leadFilesKey = (boardKey: string, leadId?: string) =>
  (leadId ? ["crm", "lead-files", boardKey, leadId] : ["crm", "lead-files", boardKey]) as readonly string[];

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
    staleTime: 5 * 60_000,
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

export function useLeadActivity(boardKey: string, leadId: string | undefined) {
  return useQuery({
    queryKey: leadActivityKey(boardKey, leadId ?? ""),
    queryFn: () => leadsApi.activity(boardKey, leadId!),
    enabled: Boolean(leadId),
  });
}

export function useLeadFiles(boardKey: string, leadId: string | undefined) {
  return useQuery({
    queryKey: leadFilesKey(boardKey, leadId ?? ""),
    queryFn: () => leadsApi.files(boardKey, leadId!),
    enabled: Boolean(leadId),
  });
}

function useRefreshLeadRecord(boardKey: string) {
  const qc = useQueryClient();
  return (leadId: string) => Promise.all([
    qc.invalidateQueries({ queryKey: leadFilesKey(boardKey, leadId) }),
    qc.invalidateQueries({ queryKey: leadActivityKey(boardKey, leadId) }),
  ]);
}

export function useAttachLeadFile(boardKey: string, leadId: string) {
  const refresh = useRefreshLeadRecord(boardKey);
  return useMutation({
    mutationFn: (file: File) => leadsApi.attachFile(boardKey, leadId, file),
    onSuccess: () => refresh(leadId),
  });
}

export function useRemoveLeadFile(boardKey: string, leadId: string) {
  const refresh = useRefreshLeadRecord(boardKey);
  return useMutation({
    mutationFn: (fileId: string) => leadsApi.removeFile(boardKey, leadId, fileId),
    onSuccess: () => refresh(leadId),
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
