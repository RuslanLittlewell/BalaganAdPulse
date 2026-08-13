import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  campaignsApi,
  recordsApi,
  valuesApi,
  type CampaignInput,
  type CampaignTable,
  type RecordInput,
} from "./api.js";

export function useCampaigns(clientId: string | undefined) {
  return useQuery({
    queryKey: ["clients", clientId, "campaigns"],
    queryFn: () => campaignsApi.list(clientId as string),
    enabled: clientId != null,
  });
}

export function useCampaignTable(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", campaignId],
    queryFn: () => campaignsApi.get(campaignId as string),
    enabled: campaignId != null,
  });
}

export function useCreateCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CampaignInput) => campaignsApi.create(clientId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", clientId, "campaigns"] }),
  });
}

export function useUpdateCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CampaignInput }) =>
      campaignsApi.update(id, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["clients", clientId, "campaigns"] });
      // the open sheet carries the campaign name too
      qc.invalidateQueries({ queryKey: ["campaigns", variables.id] });
    },
  });
}

export function useCreateRecord(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecordInput) => recordsApi.create(campaignId, body),
    // The table query carries the rows and the totals; both change when a day is added.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", campaignId] }),
  });
}

export function useDeleteCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) => campaignsApi.remove(campaignId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", clientId, "campaigns"] }),
  });
}

export interface SetValueInput {
  recordId: string;
  propertyId: string;
  value: string | null;
}

/**
 * The answer carries the recomputed row and totals, so one request repaints the entered
 * cell, every column derived from it and the footer — no refetch, no stale flash.
 *
 * Tabbing quickly can leave two writes in flight, and their answers may arrive out of
 * order. `totals` reflects the whole table after whichever write landed last on the
 * server, so it is genuinely global: a single counter picks the highest-sequence answer
 * and every earlier one is superseded. A record's own row is different — two answers
 * only compete over the same record, since each write only touches its own row. Tabbing
 * across a row edge puts two *different* records' writes in flight together, and an
 * older-sequence answer for one record is not superseded by a newer answer for the
 * other. So the row patch uses a per-record high-water mark: an answer lands on its
 * record unless a later answer for that same record already applied.
 */
export function useSetValue(campaignId: string) {
  const qc = useQueryClient();
  const issued = useRef(0);
  const appliedTotals = useRef(0);
  const appliedRecords = useRef(new Map<string, number>());

  return useMutation({
    mutationFn: async (input: SetValueInput) => {
      const seq = ++issued.current;
      const result = await valuesApi.set(input.recordId, input.propertyId, input.value);
      return { seq, result };
    },
    onSuccess: ({ seq, result }) => {
      const recordId = result.record.id;
      const lastForRecord = appliedRecords.current.get(recordId) ?? 0;
      const patchRecord = seq > lastForRecord;
      const patchTotals = seq > appliedTotals.current;
      if (!patchRecord && !patchTotals) return;
      if (patchRecord) appliedRecords.current.set(recordId, seq);
      if (patchTotals) appliedTotals.current = seq;

      qc.setQueryData<CampaignTable>(["campaigns", campaignId], (previous) =>
        previous == null
          ? previous
          : {
              ...previous,
              records: patchRecord
                ? previous.records.map((record) =>
                    record.id === recordId ? result.record : record,
                  )
                : previous.records,
              totals: patchTotals ? result.totals : previous.totals,
            },
      );
    },
  });
}
