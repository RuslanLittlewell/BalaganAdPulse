import { useState, type FormEvent } from "react";
import { Dialog } from "../../../../components/Dialog/Dialog.js";
import { TextField } from "../../../../components/TextField/TextField.js";
import { Button } from "../../../../components/Button/Button.js";
import { ApiError } from "../../../../lib/http.js";
import { isEmail, isPartialDecimal } from "../../../../lib/validation.js";
import { t } from "../../../../i18n/en.js";
import { useCreateClient, useUpdateClient } from "../../data/queries.js";
import type { Client, ClientInput } from "../../data/api.js";

export interface ClientFormDialogProps {
  client?: Client;
  onClose: () => void;
  onCreated?: (client: Client) => void;
}

type Fields = { name: string; niche: string; monthlyBudget: string; email: string };

function initialFields(client?: Client): Fields {
  return {
    name: client?.name ?? "",
    niche: client?.niche ?? "",
    monthlyBudget: client?.monthlyBudget ?? "",
    email: client?.email ?? "",
  };
}

function toInput(fields: Fields): ClientInput {
  const input: ClientInput = { name: fields.name.trim() };
  if (fields.niche.trim()) input.niche = fields.niche.trim();
  const budget = Number(fields.monthlyBudget);
  // A lone "." passes the keystroke filter but is not a number.
  if (fields.monthlyBudget.trim() && Number.isFinite(budget)) input.monthlyBudget = budget;
  if (fields.email.trim()) input.email = fields.email.trim();
  return input;
}

/** Client-side checks that mirror the server's schema, so errors land inline. */
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
  const [fields, setFields] = useState<Fields>(() => initialFields(client));
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const create = useCreateClient();
  const update = useUpdateClient();

  const set = (key: keyof Fields) => (e: { target: { value: string } }) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  // Drops the keystroke rather than accepting a value that cannot be a number.
  const setBudget = (e: { target: { value: string } }) => {
    const { value } = e.target;
    if (isPartialDecimal(value)) setFields((prev) => ({ ...prev, monthlyBudget: value }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const local = localErrors(fields);
    setErrors(local);
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
      setErrors(fieldErrors(err));
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onClose={onClose} title={t(isEdit ? "form.edit.title" : "form.new.title")}>
      {/* noValidate: the app renders its own inline errors, not native bubbles. */}
      <form noValidate onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <TextField label={t("form.name.label")} value={fields.name} onChange={set("name")} error={errors.name} autoFocus />
        <TextField label={t("form.niche.label")} value={fields.niche} onChange={set("niche")} error={errors.niche} />
        <TextField label={t("form.budget.label")} value={fields.monthlyBudget} onChange={setBudget} error={errors.monthlyBudget} inputMode="decimal" />
        <TextField label={t("form.email.label")} value={fields.email} onChange={set("email")} error={errors.email} type="email" />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
          <Button variant="ghost" type="button" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={pending}>
            {t(isEdit ? "action.save" : "action.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
