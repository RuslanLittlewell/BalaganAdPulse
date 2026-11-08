import { useQuery, useQueryClient } from "@tanstack/react-query";
import { campaignsApi, type DateRange } from "./api.js";
import { useObjectUrl } from "@/shared/lib/useObjectUrl.js";

const keyed = (parts: readonly unknown[], range: DateRange) =>
  [...parts, { from: range.from, to: range.to }] as const;

export function useProjectCampaigns(projectId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["projects", projectId, "campaigns"], range),
    queryFn: ({ signal }) => campaignsApi.listByProject(projectId as string, range, signal),
    enabled: projectId != null,
  });
}

export function useCampaignReferences(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId, "campaigns", "names"],
    queryFn: ({ signal }) => campaignsApi.namesByProject(projectId as string, signal),
    enabled: projectId != null,
    staleTime: 5 * 60_000,
  });
}

export function useCampaign(campaignId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["campaigns", campaignId], range),
    queryFn: ({ signal }) => campaignsApi.get(campaignId as string, range, signal),
    enabled: campaignId != null,
  });
}

export function useCampaignDaily(campaignId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["campaigns", campaignId, "daily"], range),
    queryFn: ({ signal }) => campaignsApi.daily(campaignId as string, range, signal),
    enabled: campaignId != null,
  });
}

export function useAdSets(campaignId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["campaigns", campaignId, "ad-sets"], range),
    queryFn: ({ signal }) => campaignsApi.adSets(campaignId as string, range, signal),
    enabled: campaignId != null,
  });
}

export function useAds(adSetId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["ad-sets", adSetId, "ads"], range),
    queryFn: ({ signal }) => campaignsApi.ads(adSetId as string, range, signal),
    enabled: adSetId != null,
  });
}

export function useProjectDaily(projectId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["projects", projectId, "daily"], range),
    queryFn: ({ signal }) => campaignsApi.projectDaily(projectId as string, range, signal),
    enabled: projectId != null,
  });
}

export function useProjectSummary(projectId: string | undefined, range: DateRange) {
  return useQuery({
    queryKey: keyed(["projects", projectId, "summary"], range),
    queryFn: ({ signal }) => campaignsApi.projectSummary(projectId as string, range, signal),
    enabled: projectId != null,
  });
}

export function useAgencySummary(range: DateRange) {
  return useQuery({
    queryKey: keyed(["summary"], range),
    queryFn: ({ signal }) => campaignsApi.agencySummary(range, signal),
  });
}

export const PROJECTS_SUMMARY_KEY = ["summary", "projects"] as const;

export function useRefreshCampaign() {
  const qc = useQueryClient();
  return (campaignId: string) =>
    qc.invalidateQueries({
      predicate: ({ queryKey }) =>
        (queryKey[0] === "campaigns" && queryKey[1] === campaignId && typeof queryKey[2] === "object") ||
        (queryKey[0] === "projects" && queryKey[2] === "campaigns" && typeof queryKey[3] === "object"),
    });
}

export function useProjectsSummary(range: DateRange) {
  return useQuery({
    queryKey: keyed(PROJECTS_SUMMARY_KEY, range),
    queryFn: ({ signal }) => campaignsApi.projectsSummary(range, signal),
  });
}

export function useChannelShares(range: DateRange) {
  return useQuery({
    queryKey: keyed(["summary", "channels"], range),
    queryFn: ({ signal }) => campaignsApi.channels(range, signal),
  });
}

export function useCreativeFile(creativeId: string | undefined, part: "file" | "poster") {
  const query = useQuery({
    queryKey: ["ad-creatives", creativeId, part],
    queryFn: ({ signal }) => campaignsApi.creativeBlob(creativeId as string, part, signal),
    enabled: creativeId != null,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
  const data = useObjectUrl(query.data);
  return { ...query, data };
}

export function useAdCreatives(adId: string | undefined) {
  return useQuery({
    queryKey: ["ads", adId, "creatives"],
    queryFn: ({ signal }) => campaignsApi.adCreatives(adId as string, signal),
    enabled: adId != null,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useAdPreview(adId: string | undefined) {
  return useQuery({
    queryKey: ["ads", adId, "preview"],
    queryFn: ({ signal }) => campaignsApi.adPreview(adId as string, signal),
    enabled: adId != null,
    retry: false,
    staleTime: 10 * 60_000,
  });
}
