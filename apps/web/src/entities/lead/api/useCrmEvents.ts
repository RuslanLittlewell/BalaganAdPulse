import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openRealtimeChannel, REALTIME_BASE_DELAY_MS, REALTIME_MAX_DELAY_MS } from "@/shared/lib/realtime.js";
import { crmRecordsKey } from "@/entities/crm-record/index.js";
import { leadActivityKey, leadColumnsKey, leadFieldsKey, leadFilesKey, leadsKey } from "./queries.js";

export const CRM_EVENTS_BASE_DELAY_MS = REALTIME_BASE_DELAY_MS;
export const CRM_EVENTS_MAX_DELAY_MS = REALTIME_MAX_DELAY_MS;
export const CRM_REFRESH_WINDOW_MS = 150;

const ALL_RESOURCES = ["leads", "columns", "fields", "activity", "files", "records", "counts"] as const;
type CrmResource = typeof ALL_RESOURCES[number];

export interface CrmEvent {
  kind: "crm.changed";
  orgId: string;
  board: string;
  resources?: readonly CrmResource[];
  leadId?: string;
}

export interface CrmEventsOptions {
  createSocket?: (url: string) => WebSocket;
}

export function useCrmEvents(boardKey: string | undefined, options: CrmEventsOptions = {}, clientId?: string): void {
  const queryClient = useQueryClient();
  const createSocket = options.createSocket;

  useEffect(() => {
    if (!boardKey) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const keys = new Map<string, readonly unknown[]>();

    const flush = () => {
      pending = null;
      if ([...keys.values()].some((queryKey) => queryClient.isFetching({ queryKey }) > 0)) {
        pending = setTimeout(flush, CRM_REFRESH_WINDOW_MS);
        return;
      }
      for (const queryKey of keys.values()) {
        void queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
      }
      keys.clear();
    };

    const refresh = (resources: readonly CrmResource[], leadId?: string) => {
      for (const resource of resources) {
        const selected = resource === "leads" ? [leadsKey(boardKey)]
          : resource === "columns" ? [leadColumnsKey(boardKey)]
          : resource === "fields" ? [leadFieldsKey(boardKey)]
          : resource === "activity" ? [leadActivityKey(boardKey, leadId)]
          : resource === "files" ? [leadFilesKey(boardKey, leadId)]
          : resource === "records" ? (clientId ? [crmRecordsKey(clientId)] : [])
          : resource === "counts" ? [["crm", "board-stage-counts", boardKey], ["crm", "project-stage-counts"]] : [];
        for (const key of selected) keys.set(JSON.stringify(key), key);
      }
      if (!pending) pending = setTimeout(flush, CRM_REFRESH_WINDOW_MS);
    };

    const channel = openRealtimeChannel({
      createSocket,
      onReady: (reconnected) => {
        if (reconnected) {
          if (pending) clearTimeout(pending);
          pending = null;
          refresh(ALL_RESOURCES);
          if (pending) clearTimeout(pending);
          flush();
        }
      },
      onMessage: (message) => {
        if (message.kind !== "crm.changed" || message.board !== boardKey) return;
        const event = message as unknown as CrmEvent;
        refresh(Array.isArray(event.resources) ? event.resources : ALL_RESOURCES, event.leadId);
      },
    });

    return () => {
      if (pending) clearTimeout(pending);
      channel.close();
    };
  }, [boardKey, clientId, queryClient, createSocket]);
}
