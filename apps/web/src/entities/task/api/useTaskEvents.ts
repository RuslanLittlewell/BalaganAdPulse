import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { applyTaskEvent, filterOfKey, TASKS_KEY, type TaskEvent } from "./queries.js";
import type { Task } from "./api.js";

/** Under `/api`, so the same proxy rule and platform route that reach the REST
 * endpoints reach this too. */
const REALTIME_PATH = "/api/realtime";

export const TASK_EVENTS_BASE_DELAY_MS = 1_000;
export const TASK_EVENTS_MAX_DELAY_MS = 15_000;

/** Injected by tests, which drive the connection instead of a server. */
export interface TaskEventsOptions {
  createSocket?: (url: string) => WebSocket;
}

function realtimeUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${REALTIME_PATH}`;
}

/**
 * Keeps the board current while it is open.
 *
 * Nothing is sent to authenticate: the browser attaches the same HttpOnly
 * session cookie the REST API reads to the upgrade request, and the server
 * accepts or refuses the upgrade on that alone. The page cannot read the
 * cookie, so there is no token here to put in a URL and none to leak.
 *
 * A dropped connection is retried with a widening delay, and reconnecting
 * refetches the board once. Events published while the socket was down were
 * never delivered and are not replayed, so that refetch is the only thing that
 * closes the gap.
 */
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
        // Each listing folds the event in under its own filter, so a
        // narrowed one never takes in a task it was not asking for.
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
          // A success resets the wait, so one blip does not leave the board on
          // the longest cadence for the rest of the session.
          attempt = 0;
          if (connectedBefore) void queryClient.invalidateQueries({ queryKey: TASKS_KEY });
          connectedBefore = true;
          return;
        }
        apply(payload);
      };

      // Both, because an errored socket may never emit a close.
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
