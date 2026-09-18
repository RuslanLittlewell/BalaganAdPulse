import { TaskBoard, type TaskBoardProps } from "@/widgets/task-board/index.js";
import { TaskCalendar, type TaskCalendarProps } from "@/widgets/task-calendar/index.js";
import { useTaskEvents, useTasks } from "@/entities/task/index.js";

type Held = "tasks" | "isLoading" | "isError";

export function LoadedTaskBoard(props: Omit<TaskBoardProps, Held>) {
  const { data, isLoading, isError } = useTasks();
  useTaskEvents();
  return <TaskBoard tasks={data} isLoading={isLoading} isError={isError} {...props} />;
}

export function LoadedTaskCalendar(props: Omit<TaskCalendarProps, Held>) {
  const { data, isLoading, isError } = useTasks();
  useTaskEvents();
  return <TaskCalendar tasks={data} isLoading={isLoading} isError={isError} {...props} />;
}
