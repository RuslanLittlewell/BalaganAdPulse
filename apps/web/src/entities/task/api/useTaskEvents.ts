import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { applyTaskEvent, filterOfKey, TASKS_KEY, type TaskEvent } from "./queries.js";
import type { Task } from "./api.js";

const REALTIME_PATH = "/api/realtime";

export const TASK_EVENTS_BASE_DELAY_MS = 1_000;
export const TASK_EVENTS_MAX_DELAY_MS = 15_000;

export interface TaskEventsOptions {
  createSocket?: (url: string) => WebSocket;
}

function realtimeUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${REALTIME_PATH}`;
}

export function useTaskEvents(options: TaskEventsOptions = {}): void {
  const queryClient = useQueryClient();
  const createSocket = options.createSocket;

  useEffect(() => {
    const open = createSocket ?? ((url: string) => new WebSocket(url));
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let connectedBefore = false;

    const scheduleRetry = () => {
      if (stopped) return;
      const delay = Math.min(TASK_EVENTS_BASE_DELAY_MS * 2 ** attempt, TASK_EVENTS_MAX_DELAY_MS);
      attempt += 1;
      retry = setTimeout(() => { connect(); }, delay);
    };

    const apply = (event: TaskEvent) => {
      for (const [key, tasks] of queryClient.getQueriesData<Task[]>({ queryKey: TASKS_KEY })) {
        if (!tasks) continue;
        queryClient.setQueryData<Task[]>(key, applyTaskEvent(tasks, event, filterOfKey(key)));
      }
    };

    const connect = () => {
      if (stopped) return;
      const client = open(realtimeUrl());
      socket = client;

      client.onmessage = (message: MessageEvent) => {
        let payload: TaskEvent | { kind: "ready" };
        try {
          payload = JSON.parse(String(message.data)) as TaskEvent | { kind: "ready" };
        } catch {
          return;
        }
        if (payload.kind === "ready") {
          attempt = 0;
          if (connectedBefore) void queryClient.invalidateQueries({ queryKey: TASKS_KEY });
          connectedBefore = true;
          return;
        }
        apply(payload);
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
  }, [queryClient, createSocket]);
}
