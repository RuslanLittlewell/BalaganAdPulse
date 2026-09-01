import { useInfiniteQuery } from "@tanstack/react-query";
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
