import { TaskComments } from "./TaskComments.js";
import type { ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { dayLabel, PHONE_SHEET_CLASS_NAME } from "@/shared/ui/index.js";
import { cn } from "@/shared/lib/index.js";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import { participantsOf, timeRange, type Task } from "@/entities/task/index.js";
import { TaskAttachments } from "./TaskAttachments.js";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor.js";

export interface TaskPreviewDialogProps {
  task: Task;
  onClose: () => void;
}

const PRIORITY_TONE: Record<Task["priority"], string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-muted text-muted-foreground",
  HIGH: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  URGENT: "bg-destructive/10 text-destructive",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-foreground">
        {children}
      </span>
    </div>
  );
}

export function TaskPreviewDialog({ task, onClose }: TaskPreviewDialogProps) {
  const { data: projects } = useProjects();
  const { data: members } = useMembers();

  const project = projects?.find(
    (candidate) => candidate.id === task.projectId,
  );
  const people = participantsOf(task, members);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "flex max-h-[80vh] w-[min(720px,calc(100vw-2rem))] flex-col",
          PHONE_SHEET_CLASS_NAME,
          "max-md:p-3",
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Fact label={t("tasks.form.column")}>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                {t(`tasks.column.${task.column}`)}
              </span>
            </Fact>
            <Fact label={t("tasks.form.priority")}>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs",
                  PRIORITY_TONE[task.priority],
                )}
              >
                {t(`tasks.priority.${task.priority}`)}
              </span>
            </Fact>
            <Fact label={t("tasks.form.project")}>
              {project ? <ProjectAvatar project={project} size="sm" /> : null}
              <span className="truncate">
                {project?.name ?? t("tasks.noProject")}
              </span>
            </Fact>
            <Fact label={t("tasks.form.participants")}>
              {people.length > 0 ? (
                people.map((member) => (
                  <span key={member.id} className="flex min-w-0 items-center gap-1">
                    <MemberAvatar member={member} size="sm" />
                    <span className="truncate">{member.name}</span>
                  </span>
                ))
              ) : (
                <span className="truncate">{t("tasks.participants.nobody")}</span>
              )}
            </Fact>
            <Fact label={t("tasks.form.due")}>
              <span className="truncate">
                {task.dueDate === null
                  ? t("tasks.form.noDue")
                  : `${dayLabel(task.dueDate)}${task.dueTime ? `, ${timeRange(task)}` : ""}`}
              </span>
            </Fact>
            {task.repeatEvery === "NONE" ? null : (
              <Fact label={t("tasks.form.repeat")}>
                <span className="truncate">
                  {t(`tasks.repeat.${task.repeatEvery}`)}
                </span>
              </Fact>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("tasks.form.description")}
            </span>
            {task.description == null ? (
              <p className="text-sm text-muted-foreground">
                {t("tasks.noDescription")}
              </p>
            ) : (
              <TaskDescriptionEditor
                value={task.description}
                onChange={() => {}}
                editable={false}
              />
            )}
          </div>

          {task.checklist.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {`${t("tasks.checklist")} · ${task.checklist.filter((item) => item.done).length} ${t("tasks.checklist.of")} ${task.checklist.length}`}
              </span>
              <ul className="flex flex-col gap-1">
                {task.checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled
                      readOnly
                      className="size-3 accent-primary"
                    />
                    <span
                      className={
                        item.done ? "text-muted-foreground line-through" : ""
                      }
                    >
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {task.imageIds.length > 0 ? (
            <TaskAttachments imageIds={task.imageIds} />
          ) : null}

          <TaskComments task={task} />
        </div>

        <DialogFooter className="shrink-0 max-md:hidden">
          <Button variant="outline" onClick={onClose}>
            {t("action.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
