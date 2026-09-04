import { useQuery } from "@tanstack/react-query";
import { campaignsApi, type DateRange } from "./api.js";

const keyed = (parts: readonly unknown[], range: DateRange) =>
  [...parts, { from: range.from, to: range.to }] as const;

export function useProjectCampaigns(projectId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["projects", projectId, "campaigns"], range),
    queryFn: () => campaignsApi.listByProject(projectId as string, range),
    enabled: projectId != null,
  });
}

export function useCampaignReferences(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId, "campaigns", "names"],
    queryFn: () => campaignsApi.namesByProject(projectId as string),
    enabled: projectId != null,
  });
}

export function useCampaign(campaignId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["campaigns", campaignId], range),
    queryFn: () => campaignsApi.get(campaignId as string, range),
    enabled: campaignId != null,
  });
}

export function useCampaignDaily(campaignId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["campaigns", campaignId, "daily"], range),
    queryFn: () => campaignsApi.daily(campaignId as string, range),
    enabled: campaignId != null,
  });
}

export function useAdSets(campaignId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["campaigns", campaignId, "ad-sets"], range),
    queryFn: () => campaignsApi.adSets(campaignId as string, range),
    enabled: campaignId != null,
  });
}

export function useAds(adSetId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["ad-sets", adSetId, "ads"], range),
    queryFn: () => campaignsApi.ads(adSetId as string, range),
    enabled: adSetId != null,
  });
}

export function useProjectDaily(projectId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["projects", projectId, "daily"], range),
    queryFn: () => campaignsApi.projectDaily(projectId as string, range),
    enabled: projectId != null,
  });
}

export function useProjectSummary(projectId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["projects", projectId, "summary"], range),
    queryFn: () => campaignsApi.projectSummary(projectId as string, range),
    enabled: projectId != null,
  });
}

export function useAgencySummary(range: DateRange) {
  return useQuery({
    queryKey: keyed(["summary"], range),
    queryFn: () => campaignsApi.agencySummary(range),
  });
}

export function useChannelShares(range: DateRange) {
  return useQuery({
    queryKey: keyed(["summary", "channels"], range),
    queryFn: () => campaignsApi.channels(range),
  });
}
