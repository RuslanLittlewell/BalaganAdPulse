import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { XIcon } from "lucide-react";
import { ApiError, fieldProblems } from "@/shared/lib/index.js";
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
  Separator,
  Switch,
  TextField,
  toIso,
  useAlerts,
} from "@/shared/ui/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import { channelLabel, useProjectCampaignNames } from "@/entities/campaign/index.js";
import {
  TASK_PRIORITIES,
  collectImageIds,
  useCreateTask,
  useUpdateTask,
  type Task,
  type TaskColumn,
  type TaskInput,
  type TaskRepeat,
} from "@/entities/task/index.js";
import {
  filledBlocks,
  offeredBlocks,
  shownBlocks,
  type TaskBlock,
} from "../model/blocks.js";
import { useChecklistDraft } from "../model/useChecklistDraft.js";
import { TaskAttachments } from "./TaskAttachments.js";
import { TaskDescriptionEditor, type TaskDescriptionEditorHandle } from "./TaskDescriptionEditor.js";
import { TaskChecklist } from "./TaskChecklist.js";
import { TaskSchedule } from "./TaskSchedule.js";

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
  dueDate: string | null;
  dueTime: string | null;
  repeatEvery: TaskRepeat;
}

const UNASSIGNED = "";

const WHOLE_PROJECT = "__whole_project__";

const NO_PROJECT = "__no_project__";

const EMPTY = { noProject: NO_PROJECT, wholeProject: WHOLE_PROJECT, unassigned: UNASSIGNED };

const messageOf = (error: unknown) =>
  error instanceof ApiError && error.status < 500 ? error.message : t("tasks.saveFailed");

const FORM_FIELDS = [
  "projectId",
  "title",
  "priority",
  "assigneeId",
  "campaignId",
  "visibleToClient",
  "dueDate",
  "dueTime",
  "repeatEvery",
] as const satisfies readonly (keyof FormValues)[];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-sm text-destructive">{message}</p>;
}

function Block({
  block,
  onRemove,
  children,
}: {
  block: TaskBlock;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 pt-1 border-t-1 border-border" data-testid={`task-block-${block}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t(`tasks.block.${block}`)}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={t(`tasks.block.remove.${block}`)}
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      </div>
      {children}
    </div>
  );
}

export function TaskFormDialog({ task, column, onClose, onDelete }: TaskFormDialogProps) {
  const { data: projects } = useProjects();
  const { data: members } = useMembers();
  const create = useCreateTask();
  const update = useUpdateTask();
  const checklist = useChecklistDraft(task?.checklist ?? []);
  const [description, setDescription] = useState<unknown | null>(task?.description ?? null);
  const [opened, setOpened] = useState<ReadonlySet<TaskBlock>>(() => new Set());

  const attachmentIds = useMemo(
    () => [...new Set([...(task?.imageIds ?? []), ...collectImageIds(description)])],
    [task?.imageIds, description],
  );
  const { raise } = useAlerts();
  const editor = useRef<TaskDescriptionEditorHandle>(null);
  const content = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const requestClose = () => setOpen(false);
  const closedRef = useRef(false);
  const finalizeClose = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  };
  useEffect(() => {
    if (open) return;
    const fallback = setTimeout(finalizeClose, 250);
    return () => clearTimeout(fallback);
  }, [open]);

  const { control, handleSubmit, register, setError, setValue, watch, formState: { errors } } =
    useForm<FormValues>({
      defaultValues: {
        projectId: task?.projectId ?? NO_PROJECT,
        title: task?.title ?? "",
        priority: task?.priority ?? "MEDIUM",
        assigneeId: task?.assigneeId ?? UNASSIGNED,
        campaignId: task?.campaignId ?? WHOLE_PROJECT,
        visibleToClient: task?.visibleToClient ?? false,
        dueDate: task?.dueDate ?? null,
        dueTime: task?.dueTime ?? null,
        repeatEvery: task?.repeatEvery ?? "NONE",
      },
    });

  const mayShareWithClient = useCan("update", "member");

  const projectId = watch("projectId");
  const assigneeId = watch("assigneeId");
  const campaignId = watch("campaignId");
  const dueDate = watch("dueDate");
  const dueTime = watch("dueTime");
  const repeatEvery = watch("repeatEvery");
  const { data: campaigns } = useProjectCampaignNames(projectId || undefined);

  const shown = shownBlocks(opened, filledBlocks({
    checklistLength: checklist.items.length,
    dueDate,
    projectId,
    campaignId,
    assigneeId,
  }, EMPTY));
  const offered = offeredBlocks(shown);

  const show = (block: TaskBlock) =>
    setOpened((held) => new Set([...held, block]));

  const hide = (block: TaskBlock) => {
    setOpened((held) => new Set([...held].filter((candidate) => candidate !== block)));
    if (block === "dates") {
      setValue("dueDate", null);
      setValue("dueTime", null);
      setValue("repeatEvery", "NONE");
    }
    if (block === "checklist") checklist.clear();
    if (block === "assign") {
      setValue("projectId", NO_PROJECT);
      setValue("campaignId", WHOLE_PROJECT);
      setValue("assigneeId", UNASSIGNED);
    }
  };

  const chosenProject = useRef(projectId);
  useEffect(() => {
    if (chosenProject.current === projectId) return;
    chosenProject.current = projectId;
    setValue("campaignId", WHOLE_PROJECT);
  }, [projectId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const body: TaskInput = {
      projectId: values.projectId === NO_PROJECT ? null : values.projectId,
      title: values.title,
      priority: values.priority,
      assigneeId: values.assigneeId === UNASSIGNED ? null : values.assigneeId,
      campaignId: values.campaignId === WHOLE_PROJECT ? null : values.campaignId,
      ...(mayShareWithClient && values.projectId !== NO_PROJECT
        ? { visibleToClient: values.visibleToClient }
        : {}),
      dueDate: values.dueDate,
      dueTime: values.dueDate === null ? null : values.dueTime,
      repeatEvery: values.dueDate === null ? "NONE" : values.repeatEvery,
      checklist: checklist.items.map((item) => ({ title: item.title, done: item.done })),
      description,
      ...(column && !task ? { column } : {}),
    };
    try {
      if (task) await update.mutateAsync({ id: task.id, body });
      else await create.mutateAsync(body);
      requestClose();
    } catch (error) {
      const problems = fieldProblems(error);
      const rejected = FORM_FIELDS.filter((field) => problems[field] !== undefined);
      for (const field of rejected) setError(field, { message: problems[field] });
      if (rejected.length === 0) raise(messageOf(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(); }}>
      <DialogContent
        ref={content}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && !open) finalizeClose();
        }}
        className={
          "flex h-[min(850px,calc(100vh-2rem))] w-[min(880px,calc(100vw-2rem))] " +
          "min-w-[min(880px,calc(100vw-2rem))] flex-col sm:max-w-[880px] h-full"
        }
      >
        <DialogHeader className="shrink-0 flex-row items-center justify-between gap-3 border-border border-b pb-2">
          <DialogTitle>{task ? t("tasks.edit") : t("tasks.create")}</DialogTitle>
          <div className="flex shrink-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="task-priority" className="whitespace-nowrap text-sm font-normal text-muted-foreground">
                {t("tasks.form.priority")}
              </Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-priority" className="w-36"><SelectValue /></SelectTrigger>
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
            <FieldError message={errors.priority?.message} />
          </div>
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

          {offered.length > 0 ? (
            <div className="flex flex-wrap gap-2" data-testid="task-form-blocks">
              {offered.map((block) => (
                <Button
                  key={block}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => show(block)}
                >
                  {t(`tasks.block.${block}`)}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <Label>{t("tasks.form.description")}</Label>
            <TaskDescriptionEditor
              ref={editor}
              className="flex min-h-0 flex-1 flex-col"
              value={description}
              onChange={setDescription}
            />
          </div>

          {shown.map((block) => (
            <Block key={block} block={block} onRemove={() => hide(block)}>
              {block === "checklist" ? (
                <TaskChecklist
                  items={checklist.items}
                  onAdd={checklist.add}
                  onChange={checklist.change}
                  onRemove={checklist.remove}
                />
              ) : null}

              {block === "dates" ? (
                <TaskSchedule
                  dueDate={dueDate}
                  dueTime={dueTime}
                  repeatEvery={repeatEvery}
                  today={toIso(new Date())}
                  onDueDateChange={(value) => {
                    setValue("dueDate", value);
                    if (value !== null) return;
                    setValue("dueTime", null);
                    setValue("repeatEvery", "NONE");
                  }}
                  onDueTimeChange={(value) => setValue("dueTime", value)}
                  onRepeatChange={(value) => setValue("repeatEvery", value)}
                />
              ) : null}

              {block === "assign" ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="task-project">{t("tasks.form.project")}</Label>
                    <Controller
                      control={control}
                      name="projectId"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="task-project" className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_PROJECT}>{t("tasks.noProject")}</SelectItem>
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
                    <FieldError message={errors.projectId?.message} />
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="task-campaign">{t("tasks.form.campaign")}</Label>
                    <Controller
                      control={control}
                      name="campaignId"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={projectId === NO_PROJECT}
                        >
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
                    <FieldError message={errors.campaignId?.message} />
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="task-assignee">{t("tasks.form.assignee")}</Label>
                    <Controller
                      control={control}
                      name="assigneeId"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="task-assignee" className="w-full">
                            <SelectValue placeholder={t("tasks.form.unassigned")} />
                          </SelectTrigger>
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
                    <FieldError message={errors.assigneeId?.message} />
                  </div>
                </div>
              ) : null}
            </Block>
          ))}

          <TaskAttachments
            imageIds={attachmentIds}
            onRemoved={(imageId) => editor.current?.removeImage(imageId)}
          />

          </div>

          <DialogFooter
            data-testid="task-form-footer"
            className="shrink-0 items-center border-t border-border pt-4 sm:justify-between"
          >
            {mayShareWithClient && projectId !== NO_PROJECT ? (
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="visibleToClient"
                  render={({ field }) => (
                    <Switch
                      id="task-visible-to-client"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="task-visible-to-client" className="text-sm font-normal">
                  {t("tasks.form.visibleToClient")}
                </Label>
              </div>
            ) : <span />}

            <div className="flex items-center gap-2">
              {task && onDelete ? (
                <Can action="delete" resource="task">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                    onClick={() => onDelete(task)}
                  >
                    {t("tasks.delete")}
                  </Button>
                </Can>
              ) : null}
              <Button type="button" variant="outline" onClick={requestClose}>
                {t("action.cancel")}
              </Button>
              <Button type="submit">{task ? t("tasks.form.save") : t("tasks.form.create")}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
