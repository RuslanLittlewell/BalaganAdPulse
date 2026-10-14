import { useCallback } from "react";
import { doneToggleFor, useCompleteTask, useMoveTask, type Task } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";

export function useDoneToggle(onFail: (message: string) => void): (task: Task) => void {
  const { mutate: move } = useMoveTask();
  const { mutate: complete } = useCompleteTask();

  return useCallback((task: Task) => {
    const action = doneToggleFor(task);
    if (action.kind === "complete") {
      complete(task.id, { onError: () => onFail(t("tasks.completeFailed")) });
      return;
    }
    move({ id: task.id, body: action.move }, { onError: () => onFail(t("tasks.doneFailed")) });
  }, [complete, move, onFail]);
}
