import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ApiError, isPartialDecimal, toSquarePng } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  ConfirmDialog,
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
import { useClients } from "@/entities/client/index.js";
import {
  ProjectAvatar,
  useCreateProject,
  useDeleteProject,
  useSaveProjectAvatar,
  useUpdateProject,
  type Project,
  type ProjectInput,
} from "@/entities/project/index.js";

/** Marks a picture the user supplied, as opposed to one the avatar editor made. */
const UPLOADED = JSON.stringify({ source: "upload" });

export interface ProjectFormDialogProps {
  project?: Project;
  /** Preselected when the form is opened from inside a client's context. */
  clientId?: string;
  onClose: () => void;
  onSaved?: (project: Project) => void;
  /** Deletion lives here rather than beside the project's own heading: it is
   *  the one place that already means "change this project". */
  onDeleted?: () => void;
}

interface Fields {
  clientId: string;
  name: string;
  niche: string;
  monthlyBudget: string;
}

function toInput(fields: Fields): ProjectInput {
  const budget = Number(fields.monthlyBudget);
  return {
    clientId: fields.clientId,
    name: fields.name.trim(),
    niche: fields.niche.trim() || null,
    // A lone "." passes the keystroke filter but is not a number.
    monthlyBudget:
      fields.monthlyBudget.trim() && Number.isFinite(budget) ? budget : null,
  };
}

export function ProjectFormDialog({
  project,
  clientId,
  onClose,
  onSaved,
  onDeleted,
}: ProjectFormDialogProps) {
  const isEdit = project != null;
  const clients = useClients();
  const create = useCreateProject();
  const update = useUpdateProject();
  const saveAvatar = useSaveProjectAvatar();
  const remove = useDeleteProject();
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Fields>({
    defaultValues: {
      clientId: project?.clientId ?? clientId ?? "",
      name: project?.name ?? "",
      niche: project?.niche ?? "",
      monthlyBudget: project?.monthlyBudget ?? "",
    },
  });

  const submit = handleSubmit(async (fields) => {
    setFailure(null);
    try {
      const saved = isEdit
        ? await update.mutateAsync({ id: project.id, body: toInput(fields) })
        : await create.mutateAsync(toInput(fields));

      // The logo can only be stored once the project has an id, so it follows
      // the save rather than travelling with it.
      const withLogo = logo
        ? await saveAvatar.mutateAsync({
            id: saved.id,
            png: await toSquarePng(logo),
            avatarPath: UPLOADED,
          })
        : saved;

      onSaved?.(withLogo);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        for (const issue of error.details) {
          const path = (issue as { path?: unknown[] }).path;
          const message = (issue as { message?: string }).message;
          const key = Array.isArray(path) ? String(path[0]) : "";
          if (key && message) setError(key as keyof Fields, { message });
        }
      }
      setFailure(t("project.logo.failed"));
    }
  });

  const pending = create.isPending || update.isPending || saveAvatar.isPending;
  const noClients = clients.isSuccess && clients.data.length === 0;

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[min(640px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{t(isEdit ? "project.form.edit.title" : "project.form.new.title")}</DialogTitle>
        </DialogHeader>

        <form noValidate className="grid gap-3" onSubmit={(event) => void submit(event)}>
          <TextField
            compact
            label={t("project.name.label")}
            {...register("name", { required: t("project.name.required") })}
            error={errors.name?.message}
            autoFocus
          />

          <div className="grid gap-1">
            <Label htmlFor="project-client" className="text-xs text-muted-foreground">
              {t("project.client.label")}
            </Label>
            <Controller
              control={control}
              name="clientId"
              rules={{ required: t("project.client.required") }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="project-client" className="w-full">
                    <SelectValue placeholder={t("project.client.label")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients.data ?? []).map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.clientId != null && (
              <p className="text-xs text-destructive">{errors.clientId.message}</p>
            )}
            {noClients && (
              <p className="text-xs text-muted-foreground">{t("project.client.empty")}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              compact
              label={t("project.niche.label")}
              {...register("niche")}
              error={errors.niche?.message}
            />
            <Controller
              control={control}
              name="monthlyBudget"
              render={({ field }) => (
                <TextField
                  compact
                  label={t("project.budget.label")}
                  {...field}
                  onChange={(event) => {
                    if (isPartialDecimal(event.target.value)) field.onChange(event);
                  }}
                  error={errors.monthlyBudget?.message}
                  inputMode="decimal"
                />
              )}
            />
          </div>

          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("project.logo.label")}</Label>
            <div className="flex items-center gap-3">
              {project != null && <ProjectAvatar project={project} />}
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                {t("project.logo.pick")}
              </Button>
              {logo != null && (
                <span className="min-w-0 truncate text-xs text-muted-foreground">{logo.name}</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label={t("project.logo.label")}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                setLogo(file);
              }}
            />
          </div>

          {failure != null && (
            <p role="alert" className="text-xs text-destructive">{failure}</p>
          )}

          <DialogFooter className="sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirming(true)}
              >
                {t("project.delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t("action.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {t(isEdit ? "action.save" : "action.create")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {isEdit && (
        <ConfirmDialog
          open={confirming}
          title={t("project.delete.title")}
          description={t("project.delete.body")}
          pending={remove.isPending}
          onConfirm={() => {
            void (async () => {
              await remove.mutateAsync(project.id);
              setConfirming(false);
              onDeleted?.();
              onClose();
            })();
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </Dialog>
  );
}
