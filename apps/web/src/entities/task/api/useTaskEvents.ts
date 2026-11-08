import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { applyTaskEvent, filterOfKey, TASKS_KEY, type TaskEvent } from "./queries.js";
import type { Task } from "./api.js";
import { localTask } from "../lib/zone.js";

import { openRealtimeChannel, REALTIME_BASE_DELAY_MS, REALTIME_MAX_DELAY_MS } from "@/shared/lib/realtime.js";

const TASK_EVENT_KINDS = new Set<TaskEvent["kind"]>([
  "task.created",
  "task.updated",
  "task.moved",
  "task.deleted",
]);

export const TASK_EVENTS_BASE_DELAY_MS = REALTIME_BASE_DELAY_MS;
export const TASK_EVENTS_MAX_DELAY_MS = REALTIME_MAX_DELAY_MS;

export interface TaskEventsOptions {
  createSocket?: (url: string) => WebSocket;
}

export function useTaskEvents(options: TaskEventsOptions = {}): void {
  const queryClient = useQueryClient();
  const createSocket = options.createSocket;

  useEffect(() => {
    const apply = (event: TaskEvent) => {
      for (const [key, tasks] of queryClient.getQueriesData<Task[]>({ queryKey: TASKS_KEY })) {
        if (!tasks) continue;
        queryClient.setQueryData<Task[]>(key, applyTaskEvent(tasks, event, filterOfKey(key)));
      }
    };

    const channel = openRealtimeChannel({
      createSocket,
      onReady: (reconnected) => {
        if (reconnected) void queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      },
      onMessage: (payload) => {
        if (!TASK_EVENT_KINDS.has(payload.kind as TaskEvent["kind"])) return;
        const event = payload as unknown as TaskEvent;
        apply(event.kind === "task.deleted" ? event : { ...event, task: localTask(event.task) });
      },
    });

    return () => { channel.close(); };
  }, [queryClient, createSocket]);
}
