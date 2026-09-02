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
  TextField,
} from "@/shared/ui/index.js";
import { Can } from "@/features/permissions/index.js";
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
  /** The column the task should land in, when the dialog was opened from one.
   * Left out when opened from the page header, so the API applies its own
   * default rather than being handed a column nobody chose. */
  column?: TaskColumn;
  onClose: () => void;
  /** Only offered when editing; the page owns the confirmation. */
  onDelete?: (task: Task) => void;
}

interface FormValues {
  projectId: string;
  title: string;
  priority: Task["priority"];
  assigneeId: string;
  campaignId: string;
}

/** The select's "nobody" option. An empty string is what a Radix select uses
 * for no choice, and it maps to the API's null. */
const UNASSIGNED = "";

/**
 * The campaign select's "the project as a whole" option.
 *
 * A Radix item cannot carry an empty value, so the absence needs a token of its
 * own — and it deserves one anyway: choosing Общий is a statement about the
 * work, not a refusal to answer. It maps to the API's null.
 */
const WHOLE_PROJECT = "__whole_project__";

export function TaskFormDialog({ task, column, onClose, onDelete }: TaskFormDialogProps) {
  const { data: projects } = useProjects();
  const { data: members } = useMembers();
  const create = useCreateTask();
  const update = useUpdateTask();
  const [description, setDescription] = useState<unknown | null>(task?.description ?? null);

  /**
   * What the attachments block lists.
   *
   * Taken from the description as it stands, not from the saved task: an upload
   * is not attached to a task until the task is saved, so listing only
   * `task.imageIds` meant a file pasted into the description turned up in the
   * block for the first time after closing and reopening. The saved ids are
   * kept alongside, so a file already claimed stays listed while it is being
   * edited.
   */
  const attachmentIds = useMemo(
    () => [...new Set([...(task?.imageIds ?? []), ...collectImageIds(description)])],
    [task?.imageIds, description],
  );
  const [failure, setFailure] = useState<string | null>(null);
  const editor = useRef<TaskDescriptionEditorHandle>(null);

  const { control, handleSubmit, register, setValue, watch, formState: { errors } } =
    useForm<FormValues>({
      defaultValues: {
        projectId: task?.projectId ?? "",
        title: task?.title ?? "",
        priority: task?.priority ?? "MEDIUM",
        assigneeId: task?.assigneeId ?? UNASSIGNED,
        campaignId: task?.campaignId ?? WHOLE_PROJECT,
      },
    });

  /* The campaigns to choose between belong to the chosen project, so there is
     nothing to offer until one is chosen. */
  const projectId = watch("projectId");
  const { data: campaigns } = useCampaignReferences(projectId || undefined);

  /* Moving to another project releases the campaign: the old one is not under
     the new project, and the API would refuse it. Clearing it here makes the
     release visible before saving rather than discovered afterwards. The task's
     own project is exempt, so opening an existing task keeps its campaign. */
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
      description,
      // Only when the dialog was opened from a column. An edit never carries
      // one: moving a card is the board's job, not the form's.
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
      {/* The width is set, not capped: the dialog primitive carries its own
          `w-[min(440px,…)]`, and a `max-w-*` beside it would be inert. 880px on
          a desktop, never wider than the viewport allows — the floor of 800px
          applies only where there is room for it, so a narrow window shrinks
          the dialog rather than growing a horizontal scrollbar. */}
      <DialogContent
        className={
          "flex max-h-[80vh] w-[min(880px,calc(100vw-2rem))] " +
          "min-w-[min(800px,calc(100vw-2rem))] flex-col"
        }
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{task ? t("tasks.edit") : t("tasks.create")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <TextField
            label={t("tasks.form.title")}
            error={errors.title?.message}
            {...register("title", { required: t("tasks.form.titleRequired") })}
          />

          <div className="flex flex-col gap-2">
            <Label>{t("tasks.form.description")}</Label>
            <TaskDescriptionEditor ref={editor} value={description} onChange={setDescription} />
          </div>

          {/* max-content, not 1fr: each field takes the width its own contents
              need instead of splitting the row into equal shares. */}
          <div
            className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(0,max-content))]"
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
                  <SelectTrigger id="task-project">
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
                    <SelectTrigger id="task-campaign"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {/* First, and the default: most work is about one
                          campaign, but the whole-project case must never be
                          the one you have to hunt for. */}
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
                  <SelectTrigger id="task-assignee"><SelectValue placeholder={t("tasks.form.unassigned")} /></SelectTrigger>
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
          </div>

          {/* Shown while creating too: a file pasted into a task that does not
              exist yet still has to be visible, and removable. */}
          <TaskAttachments
            imageIds={attachmentIds}
            onRemoved={(imageId) => editor.current?.removeImage(imageId)}
          />

          {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}

          <DialogFooter className="shrink-0">
            {task && onDelete ? (
              <Can action="delete" resource="task">
                <Button type="button" variant="destructive" onClick={() => onDelete(task)}>
                  {t("tasks.delete")}
                </Button>
              </Can>
            ) : null}
            {/* Explicitly type="button": inside a form an untyped button
                submits, so cancelling would save the very task being abandoned. */}
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
