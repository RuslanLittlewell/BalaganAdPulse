import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { Trash2 } from "lucide-react";
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
  MultiSelect,
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
import { useAuth } from "@/features/auth/index.js";
import { ProjectAvatar, useProjects } from "@/entities/project/index.js";
import {
  MemberAvatar,
  useClientMembers,
  useMembers,
  type Membership,
} from "@/entities/membership/index.js";
import {
  TASK_COLUMNS,
  TASK_PRIORITIES,
  collectImageIds,
  endsAfterStart,
  mayBeCall,
  useCreateTask,
  useMoveTask,
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
import {
  TaskDescriptionEditor,
  type TaskDescriptionEditorHandle,
} from "./TaskDescriptionEditor.js";
import { TaskChecklist } from "./TaskChecklist.js";
import { TaskSchedule } from "./TaskSchedule.js";

export interface TaskFormDialogProps {
  task?: Task;
  column?: TaskColumn;
  projectId?: string;
  participantIds?: string[];
  onClose: () => void;
  onDelete?: (task: Task) => void;
}

interface FormValues {
  projectId: string;
  title: string;
  priority: Task["priority"];
  column: TaskColumn;
  participantIds: string[];
  visibleToClient: boolean;
  dueDate: string | null;
  dueTime: string | null;
  endTime: string | null;
  repeatEvery: TaskRepeat;
  isCall: boolean;
}

const NO_PROJECT = "__no_project__";

const EMPTY = {
  noProject: NO_PROJECT,
};

const messageOf = (error: unknown) =>
  error instanceof ApiError && error.status < 500
    ? error.message
    : t("tasks.saveFailed");

const FORM_FIELDS = [
  "projectId",
  "title",
  "priority",
  "participantIds",
  "visibleToClient",
  "dueDate",
  "dueTime",
  "endTime",
  "repeatEvery",
] as const satisfies readonly (keyof FormValues)[];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
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
    <div
      className="flex min-w-0 flex-col gap-1 pb-4 border-b border-border"
      data-testid={`task-block-${block}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Label>
          {t(`tasks.block.${block}`)}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
          aria-label={t(`tasks.block.remove.${block}`)}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      {children}
    </div>
  );
}

const CUSTOMER_ROLES: readonly Membership["role"][] = ["CLIENT", "CLIENT_ADMIN"];

function isCustomerMember(member: Membership): boolean {
  return CUSTOMER_ROLES.includes(member.role);
}

export function TaskFormDialog({
  task,
  column,
  projectId: givenProject,
  participantIds: givenParticipants,
  onClose,
  onDelete,
}: TaskFormDialogProps) {
  const { data: projects } = useProjects();
  const { data: members } = useMembers();
  const { user } = useAuth();
  const ownMembershipId = (members ?? []).find(
    (member) => member.userId === user?.id && member.status === "ACTIVE",
  )?.id;
  const create = useCreateTask();
  const update = useUpdateTask();
  const move = useMoveTask();
  const checklist = useChecklistDraft(task?.checklist ?? []);
  const [description, setDescription] = useState<unknown | null>(
    task?.description ?? null,
  );
  const [opened, setOpened] = useState<ReadonlySet<TaskBlock>>(() => new Set());

  const attachmentIds = useMemo(
    () => [
      ...new Set([...(task?.imageIds ?? []), ...collectImageIds(description)]),
    ],
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

  const {
    control,
    handleSubmit,
    register,
    setError,
    clearErrors,
    setValue,
    getFieldState,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      projectId: (task ? task.projectId : givenProject) ?? NO_PROJECT,
      title: task?.title ?? "",
      priority: task?.priority ?? "MEDIUM",
      column: task?.column ?? column ?? "IDEA",
      participantIds: task?.participantIds ?? givenParticipants ?? [],
      visibleToClient: task?.visibleToClient ?? false,
      dueDate: task?.dueDate ?? null,
      dueTime: task?.dueTime ?? null,
      endTime: task?.endTime ?? null,
      repeatEvery: task?.repeatEvery ?? "NONE",
      isCall: task?.isCall ?? false,
    },
  });

  const mayShareWithClient = useCan("update", "member");
  const movesTasks = useCan("update", "task");

  const projectId = watch("projectId");
  const participantIds = watch("participantIds");

  useEffect(() => {
    if (task || givenParticipants || !ownMembershipId || !movesTasks) return;
    if (getFieldState("participantIds").isDirty || participantIds.length > 0) return;
    setValue("participantIds", [ownMembershipId]);
  }, [ownMembershipId, movesTasks]);
  const dueDate = watch("dueDate");
  const dueTime = watch("dueTime");
  const endTime = watch("endTime");
  const repeatEvery = watch("repeatEvery");
  const isCall = watch("isCall");

  const chosenProject = (projects ?? []).find((project) => project.id === projectId);
  const { data: projectPeople } = useClientMembers(
    movesTasks && chosenProject ? chosenProject.clientId : undefined,
    chosenProject?.id,
  );
  const clientPeople = chosenProject
    ? (projectPeople ?? []).filter((member) => isCustomerMember(member) && member.status === "ACTIVE")
    : [];
  const offeredPeople = [
    ...(members ?? []).filter((member) => member.status === "ACTIVE" || participantIds.includes(member.id)),
    ...clientPeople,
  ];

  useEffect(() => {
    if (!members) return;
    const staff = new Set(members.map((member) => member.id));
    if (projectId !== NO_PROJECT && !projectPeople) return;
    const reaching = new Set((projectId === NO_PROJECT ? [] : projectPeople ?? []).map((member) => member.id));
    const kept = participantIds.filter((id) => staff.has(id) || reaching.has(id));
    if (kept.length !== participantIds.length) setValue("participantIds", kept);
  }, [projectId, projectPeople, members]);

  const shown = shownBlocks(
    opened,
    filledBlocks(
      {
        checklistLength: checklist.items.length,
        dueDate,
        projectId,
        participantCount: participantIds.length,
      },
      EMPTY,
    ),
  );
  const offered = offeredBlocks(shown);
  const offeredParams = offered.filter((block) => block !== "checklist");

  const show = (block: TaskBlock) =>
    setOpened((held) => new Set([...held, block]));

  const hide = (block: TaskBlock) => {
    setOpened(
      (held) => new Set([...held].filter((candidate) => candidate !== block)),
    );
    if (block === "dates") {
      setValue("dueDate", null);
      setValue("dueTime", null);
      setValue("endTime", null);
      setValue("repeatEvery", "NONE");
      setValue("isCall", false);
    }
    if (block === "checklist") checklist.clear();
    if (block === "assign") {
      setValue("projectId", NO_PROJECT);
      setValue("participantIds", []);
    }
  };

  const creationColumn = (chosen: TaskColumn) => {
    const created = movesTasks ? chosen : column;
    return created ? { column: created } : {};
  };

  const onSubmit = handleSubmit(async (values) => {
    if (
      values.dueDate !== null && values.dueTime !== null && values.endTime !== null
      && !endsAfterStart(values.dueTime, values.endTime)
    ) {
      setError("endTime", { message: t("tasks.form.endBeforeStart") });
      return;
    }
    const body: TaskInput = {
      projectId: values.projectId === NO_PROJECT ? null : values.projectId,
      title: values.title,
      priority: values.priority,
      ...(mayShareWithClient && values.projectId !== NO_PROJECT
        ? { visibleToClient: values.visibleToClient }
        : {}),
      dueDate: values.dueDate,
      dueTime: values.dueDate === null ? null : values.dueTime,
      endTime: values.dueDate === null || values.dueTime === null ? null : values.endTime,
      repeatEvery: values.dueDate === null ? "NONE" : values.repeatEvery,
      isCall: values.dueDate !== null && values.isCall && mayBeCall(values),
      checklist: checklist.items.map((item) => ({
        title: item.title,
        done: item.done,
      })),
      description,
      ...(task ? {} : creationColumn(values.column)),
      ...(movesTasks ? { participantIds: values.participantIds } : {}),
    };
    if (task && movesTasks && values.column !== task.column) {
      try {
        await move.mutateAsync({ id: task.id, body: { column: values.column, position: 0 } });
      } catch {
        raise(t("tasks.moveFailed"));
        return;
      }
    }
    try {
      if (task) await update.mutateAsync({ id: task.id, body });
      else await create.mutateAsync(body);
      requestClose();
    } catch (error) {
      const problems = fieldProblems(error);
      const rejected = FORM_FIELDS.filter(
        (field) => problems[field] !== undefined,
      );
      for (const field of rejected)
        setError(field, { message: problems[field] });
      if (rejected.length === 0) raise(messageOf(error));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
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
          <DialogTitle>
            {task ? t("tasks.edit") : t("tasks.create")}
          </DialogTitle>
          <div className="flex shrink-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              {movesTasks ? (
                <>
                  <Label
                    htmlFor="task-column"
                    className="whitespace-nowrap text-sm font-normal text-muted-foreground"
                  >
                    {t("tasks.form.column")}
                  </Label>
                  <Controller
                    control={control}
                    name="column"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="task-column" className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_COLUMNS.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              {t(`tasks.column.${stage}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </>
              ) : null}
              <Label
                htmlFor="task-priority"
                className="whitespace-nowrap text-sm font-normal text-muted-foreground"
              >
                {t("tasks.form.priority")}
              </Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-priority" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
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

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div
            data-testid="task-form-body"
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <TextField
              label={t("tasks.form.title")}
              error={errors.title?.message}
              {...register("title", {
                required: t("tasks.form.titleRequired"),
              })}
            />

            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[7fr_3fr]">
              <div
                className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-4"
                data-testid="task-form-main"
              >
                <div className="flex flex-col gap-2">
                  <Label>{t("tasks.form.description")}</Label>
                  <TaskDescriptionEditor
                    ref={editor}
                    className="flex min-h-125 flex-col"
                    value={description}
                    onChange={setDescription}
                  />
                </div>

                {offered.includes("checklist") ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => show("checklist")}
                    >
                      {t("tasks.block.checklist")}
                    </Button>
                  </div>
                ) : null}

                {shown.includes("checklist") ? (
                  <Block block="checklist" onRemove={() => hide("checklist")}>
                    <TaskChecklist
                      items={checklist.items}
                      onAdd={checklist.add}
                      onChange={checklist.change}
                      onRemove={checklist.remove}
                    />
                  </Block>
                ) : null}

                <TaskAttachments
                  imageIds={attachmentIds}
                  onRemoved={(imageId) => editor.current?.removeImage(imageId)}
                  onAttach={(imageId) => editor.current?.appendImage(imageId)}
                />
              </div>

              <div
                className="flex min-w-0 flex-col gap-4 pl-4 border-l border-border"
                data-testid="task-form-params"
              >
                {offeredParams.length > 0 ? (
                  <div
                    className="flex flex-wrap gap-2"
                    data-testid="task-form-blocks"
                  >
                    {offeredParams.map((block) => (
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

                {shown
                  .filter((block) => block !== "checklist")
                  .map((block) => (
                    <Block
                      key={block}
                      block={block}
                      onRemove={() => hide(block)}
                    >
                      {block === "dates" ? (
                        <TaskSchedule
                          dueDate={dueDate}
                          dueTime={dueTime}
                          endTime={endTime}
                          repeatEvery={repeatEvery}
                          isCall={isCall}
                          today={toIso(new Date())}
                          onDueDateChange={(value) => {
                            setValue("dueDate", value);
                            if (value !== null) return;
                            setValue("dueTime", null);
                            setValue("endTime", null);
                            setValue("repeatEvery", "NONE");
                            setValue("isCall", false);
                          }}
                          onDueTimeChange={(value) =>
                            setValue("dueTime", value)
                          }
                          onEndTimeChange={(value) => {
                            setValue("endTime", value);
                            clearErrors("endTime");
                          }}
                          endError={errors.endTime?.message}
                          onRepeatChange={(value) =>
                            setValue("repeatEvery", value)
                          }
                          onCallChange={(value) => setValue("isCall", value)}
                        />
                      ) : null}

                      {block === "assign" ? (
                        <div className="flex flex-col gap-3">
                          <div className="flex min-w-0 flex-col gap-2">
                            <Label htmlFor="task-project">
                              {t("tasks.form.project")}
                            </Label>
                            <Controller
                              control={control}
                              name="projectId"
                              render={({ field }) => (
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger
                                    id="task-project"
                                    className="w-full"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_PROJECT}>
                                      {t("tasks.noProject")}
                                    </SelectItem>
                                    {(projects ?? []).map((project) => (
                                      <SelectItem
                                        key={project.id}
                                        value={project.id}
                                      >
                                        <span className="flex min-w-0 items-center gap-2">
                                          <ProjectAvatar
                                            project={project}
                                            size="sm"
                                          />
                                          <span className="truncate">
                                            {project.name}
                                          </span>
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            <FieldError message={errors.projectId?.message} />
                          </div>

                          {movesTasks ? (
                            <div className="flex min-w-0 flex-col gap-2">
                              <Label>{t("tasks.form.participants")}</Label>
                              <MultiSelect
                                items={offeredPeople.map((member) => ({
                                  value: member.id,
                                  label: member.name,
                                  icon: <MemberAvatar member={member} size="sm" />,
                                }))}
                                chosen={participantIds}
                                onChange={(next) =>
                                  setValue("participantIds", next, { shouldDirty: true })
                                }
                                placeholder={t("tasks.form.nobody")}
                                ariaLabel={t("tasks.form.participants")}
                                className="w-full"
                              />
                              {clientPeople.length > 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  {t("tasks.form.clientPeopleNote")}
                                </p>
                              ) : null}
                              <FieldError message={errors.participantIds?.message} />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </Block>
                  ))}
              </div>
            </div>
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
                <Label
                  htmlFor="task-visible-to-client"
                  className="text-sm font-normal"
                >
                  {t("tasks.form.visibleToClient")}
                </Label>
              </div>
            ) : (
              <span />
            )}

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
              <Button type="submit">
                {task ? t("tasks.form.save") : t("tasks.form.create")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
