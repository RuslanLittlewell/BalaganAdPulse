import { useEffect, useMemo, useRef, useState } from "react";
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
  Switch,
  TextField,
} from "@/shared/ui/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import { channelLabel, useCampaignReferences } from "@/entities/campaign/index.js";
import {
  TASK_PRIORITIES,
  collectImageIds,
  useCreateTask,
  useUpdateTask,
  type Task,
  type TaskColumn,
  type TaskInput,
} from "@/entities/task/index.js";
import { TaskAttachments } from "./TaskAttachments.js";
import { TaskDescriptionEditor, type TaskDescriptionEditorHandle } from "./TaskDescriptionEditor.js";

export interface TaskFormDialogProps {
  task?: Task;
  column?: TaskColumn;
  onClose: () => void;
  onDelete?: (task: Task) => void;
}

interface FormValues {
  projectId: string;
  title: string;
  priority: Task["priority"];
  assigneeId: string;
  campaignId: string;
  visibleToClient: boolean;
}

const UNASSIGNED = "";

const WHOLE_PROJECT = "__whole_project__";

export function TaskFormDialog({ task, column, onClose, onDelete }: TaskFormDialogProps) {
  const { data: projects } = useProjects();
  const { data: members } = useMembers();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [description, setDescription] = useState<unknown | null>(task?.description ?? null);

  const attachmentIds = useMemo(
    () => [...new Set([...(task?.imageIds ?? []), ...collectImageIds(description)])],
    [task?.imageIds, description],
  );
  const [failure, setFailure] = useState<string | null>(null);
  const editor = useRef<TaskDescriptionEditorHandle>(null);
  const content = useRef<HTMLDivElement>(null);

  const { control, handleSubmit, register, setValue, watch, formState: { errors } } =
    useForm<FormValues>({
      defaultValues: {
        projectId: task?.projectId ?? "",
        title: task?.title ?? "",
        priority: task?.priority ?? "MEDIUM",
        assigneeId: task?.assigneeId ?? UNASSIGNED,
        campaignId: task?.campaignId ?? WHOLE_PROJECT,
        visibleToClient: task?.visibleToClient ?? false,
      },
    });

  const mayShareWithClient = useCan("update", "member");

  const projectId = watch("projectId");
  const { data: campaigns } = useCampaignReferences(projectId || undefined);

  const chosenProject = useRef(projectId);
  useEffect(() => {
    if (chosenProject.current === projectId) return;
    chosenProject.current = projectId;
    setValue("campaignId", WHOLE_PROJECT);
  }, [projectId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const body: TaskInput = {
      projectId: values.projectId,
      title: values.title,
      priority: values.priority,
      assigneeId: values.assigneeId === UNASSIGNED ? null : values.assigneeId,
      campaignId: values.campaignId === WHOLE_PROJECT ? null : values.campaignId,
      ...(mayShareWithClient ? { visibleToClient: values.visibleToClient } : {}),
      description,
      ...(column && !task ? { column } : {}),
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
      <DialogContent
        ref={content}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
        className={
          "flex h-[min(850px,calc(100vh-2rem))] w-[min(600px,calc(100vw-2rem))] " +
          "min-w-[min(600px,calc(100vw-2rem))] flex-col"
        }
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{task ? t("tasks.edit") : t("tasks.create")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div
            data-testid="task-form-body"
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
          >
          <TextField
            label={t("tasks.form.title")}
            error={errors.title?.message}
            {...register("title", { required: t("tasks.form.titleRequired") })}
          />

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <Label>{t("tasks.form.description")}</Label>
            <TaskDescriptionEditor
              ref={editor}
              className="flex min-h-0 flex-1 flex-col"
              value={description}
              onChange={setDescription}
            />
          </div>

          <div
            className="grid gap-3 sm:grid-cols-3"
            data-testid="task-form-selects"
          >
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="task-project">{t("tasks.form.project")}</Label>
            <Controller
              control={control}
              name="projectId"
              rules={{ required: t("tasks.form.projectRequired") }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-project" className="w-full">
                    <SelectValue placeholder={t("tasks.form.projectUnchosen")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <span className="flex min-w-0 items-center gap-2">
                          <ProjectAvatar project={project} size="sm" />
                          <span className="truncate">{project.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.projectId ? (
              <p role="alert" className="text-sm text-destructive">{errors.projectId.message}</p>
            ) : null}
          </div>

          {projectId ? (
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="task-campaign">{t("tasks.form.campaign")}</Label>
              <Controller
                control={control}
                name="campaignId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-campaign" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WHOLE_PROJECT}>{t("tasks.form.wholeProject")}</SelectItem>
                      {(campaigns ?? []).map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">{campaign.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {channelLabel(campaign.channel)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="task-assignee">{t("tasks.form.assignee")}</Label>
            <Controller
              control={control}
              name="assigneeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-assignee" className="w-full"><SelectValue placeholder={t("tasks.form.unassigned")} /></SelectTrigger>
                  <SelectContent>
                    {(members ?? []).map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <span className="flex min-w-0 items-center gap-2">
                          <MemberAvatar member={member} size="sm" />
                          <span className="truncate">{member.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="task-priority">{t("tasks.form.priority")}</Label>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-priority" className="w-full"><SelectValue /></SelectTrigger>
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

          {mayShareWithClient ? (
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="task-visible-to-client">{t("tasks.form.visibleToClient")}</Label>
              <Controller
                control={control}
                name="visibleToClient"
                render={({ field }) => (
                  <div className="flex h-9 items-center">
                    <Switch
                      id="task-visible-to-client"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            </div>
          ) : null}
          </div>

          <TaskAttachments
            imageIds={attachmentIds}
            onRemoved={(imageId) => editor.current?.removeImage(imageId)}
          />

          {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}
          </div>

          <DialogFooter className="shrink-0 border-t border-border pt-4">
            {task && onDelete ? (
              <Can action="delete" resource="task">
                <Button type="button" variant="destructive" onClick={() => onDelete(task)}>
                  {t("tasks.delete")}
                </Button>
              </Can>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button type="submit">{task ? t("tasks.form.save") : t("tasks.form.create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
