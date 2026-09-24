import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { PlusIcon } from "lucide-react";
import {
  ApiError, CURRENCY_SIGNS, toSquarePng, type Currency,
} from "@/shared/lib/index.js";
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
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextField,
} from "@/shared/ui/index.js";
import { useClients } from "@/entities/client/index.js";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/entities/project/index.js";
import {
  ProjectAvatar,
  useCreateProject,
  useDeleteProject,
  useSaveProjectAvatar,
  useUpdateProject,
  type Project,
  type ProjectInput,
} from "@/entities/project/index.js";
import { MemberAvatar, useMembers } from "@/entities/membership/index.js";
import { isCustomer } from "@adpulse/access-policy";
import { useAuth } from "@/features/auth/index.js";
import { Can, useCan } from "@/features/permissions/index.js";
import { ClientFormDialog } from "@/features/client-management/index.js";

const UPLOADED = JSON.stringify({ source: "upload" });

export interface ProjectFormDialogProps {
  project?: Project;
  clientId?: string;
  onClose: () => void;
  onSaved?: (project: Project) => void;
  onDeleted?: () => void;
}

interface Fields {
  clientId: string;
  name: string;
  budgetCurrency: Currency;
}

const ASSIGNABLE_ROLES = ["MANAGER", "GUEST"];

function StaffPicker({ chosen, onChange }: { chosen: string[]; onChange: (next: string[]) => void }) {
  const members = useMembers();
  const assignable = (members.data ?? []).filter(
    (member) => member.status === "ACTIVE" && ASSIGNABLE_ROLES.includes(member.role),
  );

  return (
    <div className="grid gap-1">
      <Label>{t("project.staff.label")}</Label>
      <MultiSelect
        items={assignable.map((member) => ({
          value: member.id,
          label: member.name,
          icon: <MemberAvatar member={member} size="sm" />,
        }))}
        chosen={chosen}
        onChange={onChange}
        placeholder={t("project.staff.none")}
        ariaLabel={t("project.staff.label")}
        className="w-full"
      />
    </div>
  );
}

function toInput(fields: Fields): ProjectInput {
  return {
    clientId: fields.clientId,
    name: fields.name.trim(),
    budgetCurrency: fields.budgetCurrency,
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
  const { role, clientIds } = useAuth();
  const ownClientId = role != null && isCustomer(role) ? clientIds[0] : undefined;
  const create = useCreateProject();
  const update = useUpdateProject();
  const saveAvatar = useSaveProjectAvatar();
  const remove = useDeleteProject();
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const mayAssignStaff = useCan("update", "member") && !isEdit;

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<Fields>({
    defaultValues: {
      clientId: project?.clientId ?? clientId ?? ownClientId ?? "",
      name: project?.name ?? "",
      budgetCurrency: project?.budgetCurrency ?? DEFAULT_CURRENCY,
    },
  });

  useEffect(() => {
    if (ownClientId != null && !isEdit) setValue("clientId", ownClientId);
  }, [ownClientId, isEdit, setValue]);

  useEffect(() => {
    if (createdClientId == null || !clients.data?.some((client) => client.id === createdClientId)) return;
    setValue("clientId", createdClientId, { shouldValidate: true });
    setCreatedClientId(null);
  }, [createdClientId, clients.data, setValue]);

  const submit = handleSubmit(async (fields) => {
    setFailure(null);
    try {
      const saved = isEdit
        ? await update.mutateAsync({ id: project.id, body: toInput(fields) })
        : await create.mutateAsync({
            ...toInput(fields),
            ...(memberIds.length > 0 ? { memberIds } : {}),
          });

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
          <div className="grid gap-6 sm:grid-cols-[1fr_4fr]">
          <div className="flex flex-col items-center gap-3 sm:border-r sm:border-border sm:pr-6">
            {project != null && <ProjectAvatar project={project} size="xl" />}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileRef.current?.click()}
            >
              {t("project.logo.pick")}
            </Button>
            {logo != null && (
              <span className="min-w-0 max-w-full truncate text-xs text-muted-foreground">{logo.name}</span>
            )}
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

            <div className="flex min-w-0 flex-col gap-3">
            <TextField
              compact
              label={t("project.name.label")}
              {...register("name", { required: t("project.name.required") })}
              error={errors.name?.message}
              autoFocus
            />
            <div className="grid gap-1">
              <Label htmlFor="project-client">
                {t("project.client.label")}
              </Label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Controller
                    control={control}
                    name="clientId"
                    rules={{ required: t("project.client.required") }}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={ownClientId != null}>
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
                </div>
                <Can action="create" resource="client">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label={t("clients.new")}
                    onClick={() => setCreatingClient(true)}
                  >
                    <PlusIcon aria-hidden="true" />
                  </Button>
                </Can>
              </div>
              {errors.clientId != null && (
                <p className="text-xs text-destructive">{errors.clientId.message}</p>
              )}
              {noClients && (
                <p className="text-xs text-muted-foreground">{t("project.client.empty")}</p>
              )}
            </div>
            {mayAssignStaff && <StaffPicker chosen={memberIds} onChange={setMemberIds} />}
            <div className="grid gap-1">
              <Label htmlFor="project-currency">{t("project.currency.label")}</Label>
              <Controller
                control={control}
                name="budgetCurrency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="project-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency} {CURRENCY_SIGNS[currency]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            </div>
          </div>

          {failure != null && (
            <p role="alert" className="text-xs text-destructive">{failure}</p>
          )}

          <DialogFooter>
            <div className="flex items-center gap-2">
              {isEdit && (
                <Can action="delete" resource="project">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                    onClick={() => setConfirming(true)}
                  >
                    {t("project.delete")}
                  </Button>
                </Can>
              )}
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

      {creatingClient && (
        <ClientFormDialog
          onClose={() => setCreatingClient(false)}
          onCreated={(client) => setCreatedClientId(client.id)}
        />
      )}

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
