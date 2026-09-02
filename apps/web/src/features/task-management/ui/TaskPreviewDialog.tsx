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
import { cn } from "@/shared/lib/index.js";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import { useCampaignReferences } from "@/entities/campaign/index.js";
import type { Task } from "@/entities/task/index.js";
import { TaskAttachments } from "./TaskAttachments.js";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor.js";

export interface TaskPreviewDialogProps {
  task: Task;
  onClose: () => void;
}

/** The same four levels the card uses, so a task looks the same wherever it is read. */
const PRIORITY_TONE: Record<Task["priority"], string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  HIGH: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  URGENT: "bg-red-600 text-white dark:bg-red-700",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">{children}</span>
    </div>
  );
}

/**
 * A task, read rather than managed.
 *
 * Opened from the project and campaign screens, which are for reading figures.
 * It carries no control that writes: the board is where work is changed, and
 * duplicating the form here would duplicate its permissions with it.
 */
export function TaskPreviewDialog({ task, onClose }: TaskPreviewDialogProps) {
  const { data: projects } = useProjects();
  const { data: members } = useMembers();
  const { data: campaigns } = useCampaignReferences(task.projectId);

  const project = projects?.find((candidate) => candidate.id === task.projectId);
  const assignee = members?.find((candidate) => candidate.id === task.assigneeId);
  const campaign = campaigns?.find((candidate) => candidate.id === task.campaignId);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="flex max-h-[80vh] w-[min(720px,calc(100vw-2rem))] flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <Fact label={t("tasks.form.column")}>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                {t(`tasks.column.${task.column}`)}
              </span>
            </Fact>
            <Fact label={t("tasks.form.priority")}>
              <span className={cn("rounded-md px-2 py-0.5 text-xs", PRIORITY_TONE[task.priority])}>
                {t(`tasks.priority.${task.priority}`)}
              </span>
            </Fact>
            <Fact label={t("tasks.form.project")}>
              {project ? <ProjectAvatar project={project} size="sm" /> : null}
              <span className="truncate">{project?.name ?? t("tasks.noProject")}</span>
            </Fact>
            {/* Named even when there is none: "the project as a whole" is what
                the task says, not something it failed to say. */}
            <Fact label={t("tasks.form.campaign")}>
              <span className="truncate">{campaign?.name ?? t("tasks.form.wholeProject")}</span>
            </Fact>
            <Fact label={t("tasks.form.assignee")}>
              {assignee ? <MemberAvatar member={assignee} size="sm" /> : null}
              <span className="truncate">{assignee?.name ?? t("tasks.form.unassigned")}</span>
            </Fact>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("tasks.form.description")}
            </span>
            {task.description == null ? (
              <p className="text-sm text-muted-foreground">{t("tasks.noDescription")}</p>
            ) : (
              <TaskDescriptionEditor value={task.description} onChange={() => {}} editable={false} />
            )}
          </div>

          {task.imageIds.length > 0 ? <TaskAttachments imageIds={task.imageIds} /> : null}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>{t("action.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
