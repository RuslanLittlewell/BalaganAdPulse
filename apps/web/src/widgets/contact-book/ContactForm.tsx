import { useForm } from "react-hook-form";
import { ApiError, isEmail } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button, TextField } from "@/shared/ui/index.js";
import {
  useCreateClient,
  useUpdateClient,
  type Client,
  type ClientInput,
} from "@/entities/client/index.js";
import { CONTACT_FIELDS, toValues, type ContactValues } from "./fields.js";

export interface ContactFormProps {
  /** Absent when a new contact is being created. */
  client?: Client;
  onDone: (client: Client) => void;
  onCancel: () => void;
}

function toInput(values: ContactValues): ClientInput {
  const input: ClientInput = { name: values.name.trim() };
  for (const field of CONTACT_FIELDS) {
    // An emptied field is sent as null so the server clears it. "" would be
    // stored as an empty string, which is a different answer from "unknown".
    const value = values[field.key].trim();
    input[field.key] = value || null;
  }
  return input;
}

function serverErrors(error: unknown): Partial<Record<keyof ContactValues, string>> {
  if (!(error instanceof ApiError)) return {};
  const errors: Partial<Record<keyof ContactValues, string>> = {};
  for (const issue of error.details) {
    const path = (issue as { path?: unknown[] }).path;
    const message = (issue as { message?: string }).message;
    const key = Array.isArray(path) ? String(path[0]) : "";
    if (key && message) errors[key as keyof ContactValues] = message;
  }
  return errors;
}

export function ContactForm({ client, onDone, onCancel }: ContactFormProps) {
  const isEdit = client != null;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ContactValues>({ defaultValues: toValues(client) });
  const create = useCreateClient();
  const update = useUpdateClient();

  const submit = handleSubmit(async (values) => {
    const body = toInput(values);
    try {
      const saved = isEdit
        ? await update.mutateAsync({ id: client.id, body })
        : await create.mutateAsync(body);
      onDone(saved);
    } catch (error) {
      for (const [key, message] of Object.entries(serverErrors(error))) {
        if (message) setError(key as keyof ContactValues, { message });
      }
    }
  });

  const pending = create.isPending || update.isPending;

  return (
    <form
      noValidate
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => void submit(event)}
      aria-label={t(isEdit ? "contacts.edit" : "contacts.new")}
    >
      <TextField
        compact
        label={t("contacts.name")}
        {...register("name", { required: t("contacts.name.required") })}
        error={errors.name?.message}
        autoFocus
      />
      {CONTACT_FIELDS.map((field) => (
        <TextField
          key={field.key}
          compact
          label={field.label}
          type={field.type}
          inputMode={field.inputMode}
          error={errors[field.key]?.message}
          {...register(
            field.key,
            field.key === "email"
              ? {
                  validate: (value) =>
                    !value.trim() || isEmail(value.trim()) || t("form.email.invalid"),
                }
              : undefined,
          )}
        />
      ))}
      {/* Same rule as a dialog footer: this form is a pane rather than a
          modal, so it does not get one for free. */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("action.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {t(isEdit ? "action.save" : "action.create")}
        </Button>
      </div>
    </form>
  );
}
