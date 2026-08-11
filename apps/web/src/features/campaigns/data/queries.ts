import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { campaignsApi, recordsApi, type CampaignInput, type RecordInput } from "./api.js";

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
