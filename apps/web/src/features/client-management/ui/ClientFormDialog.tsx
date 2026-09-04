import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/index.js";
import { TextField } from "@/shared/ui/index.js";
import { Button } from "@/shared/ui/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { isEmail } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  useCreateClient,
  useUpdateClient,
  type Client,
  type ClientInput,
} from "@/entities/client/index.js";

export interface ClientFormDialogProps {
  client?: Client;
  onClose: () => void;
  onCreated?: (client: Client) => void;
}

const CONTACT_FIELDS = ["fullName", "organization", "unp", "phone", "telegram", "website"] as const;
type ContactField = (typeof CONTACT_FIELDS)[number];

type Fields = { name: string; email: string } & Record<
  ContactField,
  string
>;

function initialFields(client?: Client): Fields {
  return {
    name: client?.name ?? "",
    email: client?.email ?? "",
    fullName: client?.fullName ?? "",
    organization: client?.organization ?? "",
    unp: client?.unp ?? "",
    phone: client?.phone ?? "",
    telegram: client?.telegram ?? "",
    website: client?.website ?? "",
  };
}

function toInput(fields: Fields): ClientInput {
  const input: ClientInput = { name: fields.name.trim() };
  if (fields.email.trim()) input.email = fields.email.trim();
  for (const field of CONTACT_FIELDS) {
    const value = fields[field].trim();
    if (value) input[field] = value;
  }
  return input;
}

function localErrors(fields: Fields): Partial<Record<keyof Fields, string>> {
  const email = fields.email.trim();
  return email && !isEmail(email) ? { email: t("form.email.invalid") } : {};
}

function fieldErrors(error: unknown): Partial<Record<keyof Fields, string>> {
  if (!(error instanceof ApiError)) return {};
  const errors: Partial<Record<keyof Fields, string>> = {};
  for (const issue of error.details) {
    const path = (issue as { path?: unknown[] }).path;
    const message = (issue as { message?: string }).message;
    const key = Array.isArray(path) ? String(path[0]) : "";
    if (key in initialFields() && message) errors[key as keyof Fields] = message;
  }
  return errors;
}

export function ClientFormDialog({ client, onClose, onCreated }: ClientFormDialogProps) {
  const isEdit = client != null;
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Fields>({ defaultValues: initialFields(client) });
  const create = useCreateClient();
  const update = useUpdateClient();

  const onSubmit = handleSubmit(async (fields) => {
    const local = localErrors(fields);
    for (const [key, message] of Object.entries(local)) if (message) setError(key as keyof Fields, { message });
    if (Object.keys(local).length > 0) return;
    const input = toInput(fields);
    try {
      if (isEdit) {
        await update.mutateAsync({ id: client.id, body: input });
      } else {
        const created = await create.mutateAsync(input);
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      for (const [key, message] of Object.entries(fieldErrors(err))) if (message) setError(key as keyof Fields, { message });
    }
  });

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[min(720px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{t(isEdit ? "form.edit.title" : "form.new.title")}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void onSubmit(event)}
          className="grid max-h-[65vh] gap-4 overflow-auto pr-1 sm:grid-cols-2"
        >
        <div className="sm:col-span-2">
            <TextField label={t("form.name.label")} {...register("name")} error={errors.name?.message} autoFocus />
          </div>
          <TextField label={t("form.email.label")} {...register("email", { validate: (value) => !value.trim() || isEmail(value.trim()) || t("form.email.invalid") })} error={errors.email?.message} type="email" />
          <TextField label={t("contacts.fullName")} {...register("fullName")} error={errors.fullName?.message} />
          <TextField label={t("contacts.organization")} {...register("organization")} error={errors.organization?.message} />
          <TextField label={t("contacts.unp")} {...register("unp")} error={errors.unp?.message} inputMode="numeric" />
          <TextField label={t("contacts.phone")} {...register("phone")} error={errors.phone?.message} type="tel" />
          <TextField label={t("contacts.telegram")} {...register("telegram")} error={errors.telegram?.message} />
          <TextField label={t("contacts.website")} {...register("website")} error={errors.website?.message} />
          <DialogFooter className="sm:col-span-2">
            <Button variant="outline" type="button" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button variant="default" type="submit" disabled={pending}>
              {t(isEdit ? "action.save" : "action.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
