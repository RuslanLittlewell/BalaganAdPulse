import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { seoApi, type SeoProblemKind, type SeoRange, type SeoSite, type SeoTopKind } from "./api.js";

const BUSY = ["QUEUED", "RUNNING"];

export const seoSitesKey = (projectId: string) => ["seo", projectId, "sites"];
export const seoSiteKey = (projectId: string, siteId: string) => ["seo", projectId, siteId];

export function useSeoSites(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  const previous = useRef<{ projectId: string; sites: Map<string, { lastSuccessAt: string | null; lastCheckAt: string | null; trafficAt: string | null }> } | null>(null);
  const sites = useQuery({
    queryKey: seoSitesKey(projectId ?? ""),
    queryFn: () => seoApi.sites(projectId as string),
    enabled: projectId != null,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((site) => BUSY.includes(site.status) || BUSY.includes(site.checkStatus) || BUSY.includes(site.analytics?.status ?? "")) ? 3000 : 60_000,
  });

  useEffect(() => {
    if (projectId == null || sites.data == null) return;
    const old = previous.current?.projectId === projectId ? previous.current.sites : null;
    for (const site of sites.data) {
      const before = old?.get(site.id);
      if (before && (before.lastSuccessAt !== site.lastSuccessAt || before.lastCheckAt !== site.lastCheckAt || before.trafficAt !== (site.analytics?.lastSuccessAt ?? null))) {
        void queryClient.invalidateQueries({ queryKey: seoSiteKey(projectId, site.id) });
      }
    }
    previous.current = {
      projectId,
      sites: new Map(sites.data.map((site) => [site.id, { lastSuccessAt: site.lastSuccessAt, lastCheckAt: site.lastCheckAt, trafficAt: site.analytics?.lastSuccessAt ?? null }])),
    };
  }, [projectId, queryClient, sites.data]);

  return sites;
}

export function useSeoSearch(projectId: string, siteId: string, range: SeoRange) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "search", range.from, range.to],
    queryFn: () => seoApi.search(projectId, siteId, range),
    enabled: range.from !== "" && range.to !== "",
  });
}

export function useSeoTop(projectId: string, siteId: string, kind: SeoTopKind, range: SeoRange, limit: number) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "top", kind, range.from, range.to, limit],
    queryFn: () => seoApi.top(projectId, siteId, kind, range, limit),
    enabled: range.from !== "" && range.to !== "",
    placeholderData: (previous) => previous,
  });
}

export function useSeoVitals(projectId: string, siteId: string, range: SeoRange) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "vitals", range.from, range.to],
    queryFn: () => seoApi.vitals(projectId, siteId, range),
    enabled: range.from !== "" && range.to !== "",
  });
}

export function useSeoTraffic(projectId: string, siteId: string, range: SeoRange) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "traffic", range.from, range.to],
    queryFn: () => seoApi.traffic(projectId, siteId, range),
    enabled: range.from !== "" && range.to !== "",
  });
}

export function useSeoAudit(projectId: string, siteId: string) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "audit"],
    queryFn: () => seoApi.audit(projectId, siteId),
    refetchInterval: (query) => (BUSY.includes(query.state.data?.status ?? "") ? 3000 : false),
  });
}

export function useSeoAuditPages(projectId: string, siteId: string, kind: SeoProblemKind | "ALL" | null) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "audit-pages", kind],
    queryFn: () => seoApi.auditPages(projectId, siteId, kind === "ALL" ? undefined : kind ?? undefined),
    enabled: kind !== null,
  });
}

export function useSeoAuditPage(projectId: string, siteId: string, pageId: string | null, range: SeoRange) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "audit-page", pageId, range.from, range.to],
    queryFn: () => seoApi.auditPage(projectId, siteId, pageId as string, range),
    enabled: pageId !== null && range.from !== "" && range.to !== "",
  });
}
