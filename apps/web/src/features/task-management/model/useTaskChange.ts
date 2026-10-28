import { useCallback } from "react";
import type { Task } from "@/entities/task/index.js";
import { useCan } from "@/features/permissions/index.js";

export function useTaskChange() {
  const changesTasks = useCan("update", "task");
  return useCallback(
    (task: Pick<Task, "personal">) => changesTasks || task.personal,
    [changesTasks],
  );
}
