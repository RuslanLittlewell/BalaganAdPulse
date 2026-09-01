import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextField,
} from "@/shared/ui/index.js";
import { Can } from "@/features/permissions/index.js";
import { useProjects } from "@/entities/project/index.js";
import { useMembers } from "@/entities/membership/index.js";
import {
  TASK_PRIORITIES,
  useCreateTask,
  useUpdateTask,
  type Task,
  type TaskInput,
} from "@/entities/task/index.js";
import { TaskAttachments } from "./TaskAttachments.js";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor.js";

export interface TaskFormDialogProps {
  task?: Task;
  onClose: () => void;
  /** Only offered when editing; the page owns the confirmation. */
  onDelete?: (task: Task) => void;
}

interface FormValues {
  projectId: string;
  title: string;
  priority: Task["priority"];
  assigneeId: string;
}

/** The select's "nobody" option. An empty string is what a Radix select uses
 * for no choice, and it maps to the API's null. */
const UNASSIGNED = "";

export function TaskFormDialog({ task, onClose, onDelete }: TaskFormDialogProps) {
  const { data: projects } = useProjects();
  const { data: members } = useMembers();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [description, setDescription] = useState<unknown | null>(task?.description ?? null);
  const [failure, setFailure] = useState<string | null>(null);

  const { control, handleSubmit, register, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      projectId: task?.projectId ?? "",
      title: task?.title ?? "",
      priority: task?.priority ?? "MEDIUM",
      assigneeId: task?.assigneeId ?? UNASSIGNED,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const body: TaskInput = {
      projectId: values.projectId,
      title: values.title,
      priority: values.priority,
      assigneeId: values.assigneeId === UNASSIGNED ? null : values.assigneeId,
      description,
    };
    setFailure(null);
    try {
      if (task) await update.mutateAsync({ id: task.id, body });
      else await create.mutateAsync(body);
      onClose();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t("tasks.loadFailed"));
    }
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{task ? t("tasks.edit") : t("tasks.create")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <TextField
            label={t("tasks.form.title")}
            error={errors.title?.message}
            {...register("title", { required: t("tasks.form.titleRequired") })}
          />

          <div className="flex flex-col gap-1">
            <Label>{t("tasks.form.description")}</Label>
            <TaskDescriptionEditor value={description} onChange={setDescription} />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="task-project">{t("tasks.form.project")}</Label>
            <Controller
              control={control}
              name="projectId"
              rules={{ required: t("tasks.form.projectRequired") }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-project"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.projectId ? (
              <p role="alert" className="text-sm text-destructive">{errors.projectId.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="task-assignee">{t("tasks.form.assignee")}</Label>
            <Controller
              control={control}
              name="assigneeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-assignee"><SelectValue placeholder={t("tasks.form.unassigned")} /></SelectTrigger>
                  <SelectContent>
                    {(members ?? []).map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="task-priority">{t("tasks.form.priority")}</Label>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {t(`tasks.priority.${priority}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {task ? <TaskAttachments imageIds={task.imageIds} /> : null}

          {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}

          <DialogFooter className="shrink-0">
            {task && onDelete ? (
              <Can action="delete" resource="task">
                <Button type="button" variant="destructive" onClick={() => onDelete(task)}>
                  {t("tasks.delete")}
                </Button>
              </Can>
            ) : null}
            <Button type="submit">{task ? t("tasks.form.save") : t("tasks.form.create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
