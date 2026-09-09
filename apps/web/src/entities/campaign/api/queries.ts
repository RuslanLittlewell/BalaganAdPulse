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

export function useCreativeFile(creativeId: string | undefined, part: "file" | "poster") {
  return useQuery({
    queryKey: ["ad-creatives", creativeId, part],
    queryFn: () => campaignsApi.creativeFile(creativeId as string, part),
    enabled: creativeId != null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useAdCreatives(adId: string | undefined) {
  return useQuery({
    queryKey: ["ads", adId, "creatives"],
    queryFn: () => campaignsApi.adCreatives(adId as string),
    enabled: adId != null,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useAdPreview(adId: string | undefined) {
  return useQuery({
    queryKey: ["ads", adId, "preview"],
    queryFn: () => campaignsApi.adPreview(adId as string),
    enabled: adId != null,
    retry: false,
    staleTime: 10 * 60_000,
  });
}
