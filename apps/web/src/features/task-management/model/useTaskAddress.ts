import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Task } from "@/entities/task/index.js";
import type { OpenedTask } from "../ui/TaskDialogs.js";

type Creating = Extract<OpenedTask, { mode: "create" }>;

export interface TaskAddress {
  opened: OpenedTask;
  open: (task: Task) => void;
  create: (draft?: Omit<Creating, "mode">) => void;
  close: () => void;
}

const PARAM = "task";

export function useTaskAddress(tasks: readonly Task[] | undefined): TaskAddress {
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState<Creating | null>(null);
  const namedId = params.get(PARAM);
  const named = namedId && tasks ? tasks.find((task) => task.id === namedId) : undefined;

  useEffect(() => {
    if (!namedId || !tasks || named) return;
    setParams((current) => {
      current.delete(PARAM);
      return current;
    }, { replace: true });
  }, [namedId, tasks, named, setParams]);

  const opened: OpenedTask = creating ?? (named ? { mode: "open", task: named } : { mode: "closed" });

  return {
    opened,
    open: (task) => {
      setCreating(null);
      setParams((current) => {
        current.set(PARAM, task.id);
        return current;
      });
    },
    create: (draft = {}) => setCreating({ mode: "create", ...draft }),
    close: () => {
      setCreating(null);
      if (!namedId) return;
      setParams((current) => {
        current.delete(PARAM);
        return current;
      }, { replace: true });
    },
  };
}
