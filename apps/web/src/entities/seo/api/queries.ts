import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { seoApi, type SeoProblemKind, type SeoRange, type SeoSite, type SeoTopKind } from "./api.js";

const BUSY = ["QUEUED", "RUNNING"];

export const seoSitesKey = (projectId: string) => ["seo", projectId, "sites"];
export const seoSiteKey = (projectId: string, siteId: string) => ["seo", projectId, siteId];

const refreshSubscriptions = new WeakMap<QueryClient, { count: number; close: () => void }>();

function subscribeSeoRefresh(queryClient: QueryClient): () => void {
  let subscription = refreshSubscriptions.get(queryClient);
  if (!subscription) {
    const previous = new Map<string, SeoSite[]>();
    const cache = queryClient.getQueryCache();
    for (const query of cache.getAll()) {
      if (query.queryKey[0] === "seo" && query.queryKey[2] === "sites" && query.state.data) {
        previous.set(query.queryHash, query.state.data as SeoSite[]);
      }
    }
    const close = cache.subscribe((event) => {
      const { query } = event;
      if (event.type === "removed") {
        previous.delete(query.queryHash);
        return;
      }
      if (event.type !== "updated" || event.action.type !== "success") return;
      const [kind, projectId, section] = query.queryKey;
      if (kind !== "seo" || typeof projectId !== "string" || section !== "sites") return;
      const sites = query.state.data as SeoSite[];
      const old = new Map((previous.get(query.queryHash) ?? []).map((site) => [site.id, site]));
      previous.set(query.queryHash, sites);
      for (const site of sites) {
        const before = old.get(site.id);
        if (!before) continue;
        const sections = new Set<string>();
        if (before.lastSuccessAt !== site.lastSuccessAt) {
          for (const section of ["search", "top", "vitals", "audit-page"]) sections.add(section);
        }
        if (before.lastCheckAt !== site.lastCheckAt) {
          for (const section of ["audit", "audit-pages", "audit-page"]) sections.add(section);
        }
        if (before.analytics?.lastSuccessAt !== site.analytics?.lastSuccessAt) sections.add("traffic");
        if (sections.size === 0) continue;
        void queryClient.invalidateQueries({
          predicate: ({ queryKey }) => queryKey[0] === "seo" && queryKey[1] === projectId
            && queryKey[2] === site.id && sections.has(String(queryKey[3])),
        });
      }
    });
    subscription = { count: 0, close };
    refreshSubscriptions.set(queryClient, subscription);
  }
  const shared = subscription;
  shared.count += 1;
  return () => {
    shared.count -= 1;
    if (shared.count === 0) {
      shared.close();
      refreshSubscriptions.delete(queryClient);
    }
  };
}

export function useSeoSites(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => projectId != null ? subscribeSeoRefresh(queryClient) : undefined, [projectId, queryClient]);
  return useQuery({
    queryKey: seoSitesKey(projectId ?? ""),
    queryFn: ({ signal }) => seoApi.sites(projectId as string, signal),
    enabled: projectId != null,
    staleTime: 10_000,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((site) => BUSY.includes(site.status) || BUSY.includes(site.checkStatus) || BUSY.includes(site.analytics?.status ?? "")) ? 3000 : 60_000,
  });
}

export function useSeoSearch(projectId: string, siteId: string, range: SeoRange) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "search", range.from, range.to],
    queryFn: ({ signal }) => seoApi.search(projectId, siteId, range, signal),
    enabled: range.from !== "" && range.to !== "",
  });
}

export function useSeoTop(projectId: string, siteId: string, kind: SeoTopKind, range: SeoRange, limit: number) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "top", kind, range.from, range.to, limit],
    queryFn: ({ signal }) => seoApi.top(projectId, siteId, kind, range, limit, signal),
    enabled: range.from !== "" && range.to !== "",
    placeholderData: (previous) => previous,
  });
}

export function useSeoVitals(projectId: string, siteId: string, range: SeoRange) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "vitals", range.from, range.to],
    queryFn: ({ signal }) => seoApi.vitals(projectId, siteId, range, signal),
    enabled: range.from !== "" && range.to !== "",
  });
}

export function useSeoTraffic(projectId: string, siteId: string, range: SeoRange) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "traffic", range.from, range.to],
    queryFn: ({ signal }) => seoApi.traffic(projectId, siteId, range, signal),
    enabled: range.from !== "" && range.to !== "",
  });
}

export function useSeoAudit(projectId: string, siteId: string) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "audit"],
    queryFn: ({ signal }) => seoApi.audit(projectId, siteId, signal),
    refetchInterval: (query) => (BUSY.includes(query.state.data?.status ?? "") ? 3000 : false),
  });
}

export function useSeoAuditPages(projectId: string, siteId: string, kind: SeoProblemKind | "ALL" | null) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "audit-pages", kind],
    queryFn: ({ signal }) => seoApi.auditPages(projectId, siteId, kind === "ALL" ? undefined : kind ?? undefined, signal),
    enabled: kind !== null,
  });
}

export function useSeoAuditPage(projectId: string, siteId: string, pageId: string | null, range: SeoRange) {
  return useQuery({
    queryKey: [...seoSiteKey(projectId, siteId), "audit-page", pageId, range.from, range.to],
    queryFn: ({ signal }) => seoApi.auditPage(projectId, siteId, pageId as string, range, signal),
    enabled: pageId !== null && range.from !== "" && range.to !== "",
  });
}
