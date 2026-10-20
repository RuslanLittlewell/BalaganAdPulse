import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { auditEventsApi, type AuditEventFilters } from "./api.js";

export const AUDIT_EVENTS_KEY = ["audit-events"] as const;

export function useAuditEvents(filters: AuditEventFilters = {}) {
  return useInfiniteQuery({
    queryKey: [...AUDIT_EVENTS_KEY, filters],
    queryFn: ({ pageParam }) => auditEventsApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export const AUDIT_ACTORS_KEY = ["audit-actors"] as const;

export function useAuditActors() {
  return useQuery({ queryKey: AUDIT_ACTORS_KEY, queryFn: auditEventsApi.actors });
}
