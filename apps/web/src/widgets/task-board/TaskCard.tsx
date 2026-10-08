import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCardView, type TaskCardViewProps } from "@/features/task-management/index.js";

export interface TaskCardProps extends Omit<TaskCardViewProps, "drag" | "style" | "ref"> {
  draggable: boolean;
}

export function TaskCard({ draggable, ...card }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: card.task.id,
    disabled: !draggable,
  });
  return (
    <TaskCardView
      {...card}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      drag={draggable ? { attributes, listeners } : undefined}
    />
  );
}
