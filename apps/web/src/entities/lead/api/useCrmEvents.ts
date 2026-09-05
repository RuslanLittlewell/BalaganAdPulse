import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { leadsKey } from "./queries.js";

const REALTIME_PATH = "/api/realtime";

export const CRM_EVENTS_BASE_DELAY_MS = 1_000;
export const CRM_EVENTS_MAX_DELAY_MS = 15_000;

export interface CrmEvent {
  kind: "crm.changed";
  orgId: string;
  board: string;
}

export interface CrmEventsOptions {
  createSocket?: (url: string) => WebSocket;
}

function realtimeUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${REALTIME_PATH}`;
}

export function useCrmEvents(boardKey: string | undefined, options: CrmEventsOptions = {}): void {
  const queryClient = useQueryClient();
  const createSocket = options.createSocket;

  useEffect(() => {
    if (!boardKey) return;

    const open = createSocket ?? ((url: string) => new WebSocket(url));
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let connectedBefore = false;

    const refetch = () => { void queryClient.invalidateQueries({ queryKey: leadsKey(boardKey) }); };

    const scheduleRetry = () => {
      if (stopped) return;
      const delay = Math.min(CRM_EVENTS_BASE_DELAY_MS * 2 ** attempt, CRM_EVENTS_MAX_DELAY_MS);
      attempt += 1;
      retry = setTimeout(() => { connect(); }, delay);
    };

    const connect = () => {
      if (stopped) return;
      const client = open(realtimeUrl());
      socket = client;

      client.onmessage = (message: MessageEvent) => {
        let payload: CrmEvent | { kind: string };
        try {
          payload = JSON.parse(String(message.data)) as CrmEvent | { kind: string };
        } catch {
          return;
        }
        if (payload.kind === "ready") {
          attempt = 0;
          if (connectedBefore) refetch();
          connectedBefore = true;
          return;
        }
        if (payload.kind !== "crm.changed") return;
        if ((payload as CrmEvent).board !== boardKey) return;
        refetch();
      };

      client.onclose = () => { if (socket === client) scheduleRetry(); };
      client.onerror = () => { client.close(); };
    };

    connect();

    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      const closing = socket;
      socket = null;
      closing?.close();
    };
  }, [boardKey, queryClient, createSocket]);
}
