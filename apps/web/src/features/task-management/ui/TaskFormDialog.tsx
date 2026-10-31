import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { Trash2, XIcon } from "lucide-react";
import { isCustomer } from "@adpulse/access-policy";
import { ApiError, cn, fieldProblems, useNarrowScreen } from "@/shared/lib/index.js";
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
  PHONE_SHEET_CLASS_NAME,
  SearchableSelect,
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
import { useCan } from "@/features/permissions/index.js";
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
import { useTaskChange } from "../model/useTaskChange.js";
import { TaskAttachments } from "./TaskAttachments.js";
import {
  TaskDescriptionEditor,
  type TaskDescriptionEditorHandle,
} from "./TaskDescriptionEditor.js";
import { TaskChecklist } from "./TaskChecklist.js";
import { TaskComments } from "./TaskComments.js";
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
  skipWeekends: boolean;
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
  readOnly,
  onRemove,
  children,
}: {
  block: TaskBlock;
  readOnly: boolean;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1 pb-4 border-b border-border"
      data-testid={`task-block-${block}`}
    >
      <div className="flex min-h-7 items-center justify-between gap-2">
        <Label>
          {t(`tasks.block.${block}`)}
        </Label>
        {readOnly ? null : (
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
        )}
      </div>
      <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
        {children}
      </fieldset>
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
  const { user, role } = useAuth();
  const customer = role !== null && isCustomer(role);
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
  const [editingDescription, setEditingDescription] = useState(!task);
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
      skipWeekends: task?.skipWeekends ?? false,
    },
  });

  const mayShareWithClient = useCan("update", "member");
  const movesTasks = useCan("update", "task");
  const deletesTasks = useCan("delete", "task");
  const changes = useTaskChange();
  const readOnly = task !== undefined && role !== null && !changes(task);
  const showsStage = movesTasks || task !== undefined;
  const narrow = useNarrowScreen();
  const formId = useId();

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
  const skipWeekends = watch("skipWeekends");

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
      setValue("skipWeekends", false);
    }
    if (block === "checklist") checklist.clear();
    if (block === "assign") {
      setValue("projectId", NO_PROJECT);
      setValue("participantIds", []);
    }
  };

  const sharesWithClient = mayShareWithClient && projectId !== NO_PROJECT;
  const personalNote = customer && projectId === NO_PROJECT;
  const deleteTask = task && onDelete && (deletesTasks || task.personal) ? () => onDelete(task) : null;
  const saveLabel = task ? t("tasks.form.save") : t("tasks.form.create");

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
    const when = {
      dueDate: values.dueDate,
      dueTime: values.dueDate === null ? null : values.dueTime,
      endTime: values.dueDate === null || values.dueTime === null ? null : values.endTime,
    };
    const unmoved = task !== undefined
      && when.dueDate === task.dueDate && when.dueTime === task.dueTime && when.endTime === task.endTime;
    const repeatEvery = values.dueDate === null ? "NONE" : values.repeatEvery;
    const body: TaskInput = {
      projectId: values.projectId === NO_PROJECT ? null : values.projectId,
      title: values.title,
      priority: values.priority,
      ...(mayShareWithClient && values.projectId !== NO_PROJECT
        ? { visibleToClient: values.visibleToClient }
        : {}),
      ...(unmoved ? {} : when),
      repeatEvery,
      skipWeekends: repeatEvery !== "NONE" && values.skipWeekends,
      isCall: values.dueDate !== null && values.isCall && mayBeCall(values),
      checklist: checklist.items.map((item) => ({
        title: item.title,
        done: item.done,
      })),
      description,
      ...(task ? {} : creationColumn(values.column)),
      ...(movesTasks ? { participantIds: values.participantIds } : {}),
    };
    if (task && changes(task) && values.column !== task.column) {
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

  const properties = (
    <div className="flex shrink-0 flex-col gap-1">
      <div className="flex items-center gap-2 max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)] max-md:gap-x-3">
        {showsStage ? (
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
                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                  <SelectTrigger id="task-column" className="w-40 max-md:w-full">
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
            <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
              <SelectTrigger id="task-priority" className="w-36 max-md:w-full">
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
  );

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
        showCloseButton={!narrow}
        className={cn(
          "flex h-[min(850px,calc(100vh-2rem))] w-[min(880px,calc(100vw-2rem))]",
          "min-w-[min(880px,calc(100vw-2rem))] flex-col sm:max-w-[880px] h-full",
          PHONE_SHEET_CLASS_NAME,
          "max-md:gap-0 max-md:overflow-hidden max-md:p-0",
        )}
      >
        <DialogHeader className="shrink-0 flex-row items-center justify-between gap-3 border-border border-b pb-2 max-md:gap-2 max-md:p-2 max-md:pr-3">
          {narrow ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={readOnly ? t("action.close") : t("action.cancel")}
              onClick={requestClose}
            >
              <XIcon aria-hidden className="size-5" />
            </Button>
          ) : null}
          <DialogTitle className="max-md:min-w-0 max-md:flex-1 max-md:truncate max-md:leading-normal">
            {task ? (readOnly ? t("tasks.view") : t("tasks.edit")) : t("tasks.create")}
          </DialogTitle>
          {!narrow ? properties : readOnly ? null : (
            <Button type="submit" form={formId} size="sm">
              {saveLabel}
            </Button>
          )}
        </DialogHeader>

        <form
          id={formId}
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 max-md:overflow-y-auto max-md:px-4 max-md:pb-6 max-md:pt-4"
        >
          <div
            data-testid="task-form-body"
            className="flex flex-col gap-4 md:min-h-0 md:flex-1"
          >
            <TextField
              label={t("tasks.form.title")}
              error={errors.title?.message}
              readOnly={readOnly}
              {...register("title", {
                required: t("tasks.form.titleRequired"),
              })}
            />

            {narrow ? properties : null}

            <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-[7fr_3fr] md:gap-0">
              <div
                className="flex min-w-0 flex-col gap-4 md:min-h-0 md:overflow-y-auto md:pr-4"
                data-testid="task-form-main"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>{t("tasks.form.description")}</Label>
                    {task && !readOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingDescription((editing) => !editing)}
                      >
                        {editingDescription ? t("tasks.description.done") : t("tasks.description.edit")}
                      </Button>
                    ) : null}
                  </div>
                  <TaskDescriptionEditor
                    ref={editor}
                    className="flex min-h-62 flex-col"
                    value={description}
                    onChange={setDescription}
                    editable={editingDescription && !readOnly}
                    onEdit={() => { if (!readOnly) setEditingDescription(true); }}
                  />
                </div>

                {offered.includes("checklist") && !readOnly ? (
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
                  <Block block="checklist" readOnly={readOnly} onRemove={() => hide("checklist")}>
                    <TaskChecklist
                      items={checklist.items}
                      onAdd={checklist.add}
                      onChange={checklist.change}
                      onRemove={checklist.remove}
                    />
                  </Block>
                ) : null}

                {readOnly ? (
                  <TaskAttachments imageIds={attachmentIds} />
                ) : (
                  <TaskAttachments
                    imageIds={attachmentIds}
                    onRemoved={(imageId) => editor.current?.removeImage(imageId)}
                    onAttach={(imageId) => editor.current?.appendImage(imageId)}
                  />
                )}

                {task ? <TaskComments task={task} /> : null}
              </div>

              <div
                className="flex min-w-0 flex-col gap-4 max-md:order-first md:border-l md:border-border md:pl-4"
                data-testid="task-form-params"
              >
                {offeredParams.length > 0 && !readOnly ? (
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
                      readOnly={readOnly}
                      onRemove={() => hide(block)}
                    >
                      {block === "dates" ? (
                        <TaskSchedule
                          dueDate={dueDate}
                          dueTime={dueTime}
                          endTime={endTime}
                          repeatEvery={repeatEvery}
                          skipWeekends={skipWeekends}
                          isCall={isCall}
                          today={toIso(new Date())}
                          onDueDateChange={(value) => {
                            setValue("dueDate", value);
                            if (value !== null) return;
                            setValue("dueTime", null);
                            setValue("endTime", null);
                            setValue("repeatEvery", "NONE");
                            setValue("isCall", false);
                            setValue("skipWeekends", false);
                          }}
                          onDueTimeChange={(value) =>
                            setValue("dueTime", value)
                          }
                          onEndTimeChange={(value) => {
                            setValue("endTime", value);
                            clearErrors("endTime");
                          }}
                          endError={errors.endTime?.message}
                          onRepeatChange={(value) => {
                            setValue("repeatEvery", value);
                            if (value === "NONE") setValue("skipWeekends", false);
                          }}
                          onSkipWeekendsChange={(value) => setValue("skipWeekends", value)}
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
                                <SearchableSelect
                                  id="task-project"
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  pinned={[{ value: NO_PROJECT, label: t("tasks.noProject") }]}
                                  options={(projects ?? []).map((project) => ({
                                    value: project.id,
                                    label: project.name,
                                    node: (
                                      <span className="flex min-w-0 items-center gap-2">
                                        <ProjectAvatar project={project} size="sm" />
                                        <span className="truncate">{project.name}</span>
                                      </span>
                                    ),
                                  }))}
                                  searchLabel={t("select.search")}
                                  emptyLabel={t("select.search.empty")}
                                />
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

          {narrow && !sharesWithClient && !personalNote && !deleteTask ? null : (
            <DialogFooter
              data-testid="task-form-footer"
              className="shrink-0 items-center border-t border-border pt-4 sm:justify-between max-md:flex-row max-md:flex-wrap max-md:justify-between"
            >
              {sharesWithClient ? (
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
              ) : personalNote ? (
                <p className="text-sm text-muted-foreground">{t("tasks.form.personal")}</p>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                {deleteTask ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                    onClick={deleteTask}
                  >
                    {t("tasks.delete")}
                  </Button>
                ) : null}
                {narrow ? null : (
                  <Button type="button" variant="outline" onClick={requestClose}>
                    {readOnly ? t("action.close") : t("action.cancel")}
                  </Button>
                )}
                {narrow || readOnly ? null : <Button type="submit">{saveLabel}</Button>}
              </div>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
