import { useMemo } from "react";
import { useAuth } from "@/features/auth/index.js";
import { useNow } from "@/shared/lib/index.js";
import { dueSoon, useTaskEvents, useTasks, viewerTimeZone } from "@/entities/task/index.js";

export function useDueTasks() {
  const membershipId = useAuth().membershipId ?? "";
  const tasks = useTasks();
  useTaskEvents();
  const now = useNow();
  const due = useMemo(
    () => (tasks.data && membershipId ? dueSoon(tasks.data, membershipId, now, viewerTimeZone()) : []),
    [tasks.data, membershipId, now],
  );
  return { due, isPending: tasks.isPending, isError: tasks.isError, retry: () => void tasks.refetch() };
}
