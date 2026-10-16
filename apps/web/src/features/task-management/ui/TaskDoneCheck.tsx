import type { SyntheticEvent } from "react";
import { isDone, type Task } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import SpringCheck from "@/shared/ui/SpringCheck/SpringCheck.js";

export interface TaskDoneCheckProps {
  task: Task;
  size?: number;
  onToggle: (task: Task) => void;
}

function keepToItself(event: SyntheticEvent) {
  event.stopPropagation();
}

export function TaskDoneCheck({ task, size = 16, onToggle }: TaskDoneCheckProps) {
  return (
    <span
      className="inline-flex shrink-0"
      data-testid={`task-done-${task.id}`}
      onClick={keepToItself}
      onKeyDown={keepToItself}
      onPointerDown={keepToItself}
      onMouseDown={keepToItself}
    >
      <SpringCheck
        checked={isDone(task)}
        onChange={() => onToggle(task)}
        ariaLabel={`${t("tasks.done")}: ${task.title}`}
        label={null}
        strike="none"
        className="gap-0!"
        boxSize={size}
        boxRadius={Math.round(size / 3)}
        fontSize={0}
        color="var(--foreground)"
        fillColor="var(--primary)"
        checkColor="var(--primary-foreground)"
      />
    </span>
  );
}
