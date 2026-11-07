import { useState, type FormEvent } from "react";
import {
  isListField,
  LEAD_FIELD_TYPES,
  useCreateLeadField,
  useUpdateLeadField,
  type LeadField,
  type LeadFieldType,
} from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextField,
} from "@/shared/ui/index.js";
import { draftOf, draftProblems, newOption, optionsBody, optionsChanged, type DraftProblems, type FieldDraft } from "../lib/fieldDraft.js";
import { OptionsEditor } from "./OptionsEditor.js";

export interface FieldFormProps {
  boardKey: string;
  fields: readonly LeadField[];
  field?: LeadField;
  onDone: () => void;
}

export function FieldForm({ boardKey, fields, field, onDone }: FieldFormProps) {
  const create = useCreateLeadField(boardKey);
  const update = useUpdateLeadField(boardKey);
  const [draft, setDraft] = useState<FieldDraft>(() => draftOf(field));
  const [problems, setProblems] = useState<DraftProblems>({});
  const [failed, setFailed] = useState(false);
  const pending = create.isPending || update.isPending;

  const changeType = (type: LeadFieldType) =>
    setDraft((current) => ({
      ...current,
      type,
      options: isListField(type) && current.options.length === 0 ? [newOption(0)] : current.options,
    }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = draftProblems(draft, fields, field?.id);
    setProblems(found);
    setFailed(false);
    if (found.name || found.options) return;
    const name = draft.name.trim();
    try {
      if (field) {
        const body = {
          ...(name === field.name ? {} : { name }),
          ...(isListField(field.type) && optionsChanged(draft, field) ? { options: optionsBody(draft) } : {}),
        };
        if (Object.keys(body).length > 0) await update.mutateAsync({ id: field.id, body });
      } else {
        await create.mutateAsync({ name, type: draft.type, ...(isListField(draft.type) ? { options: optionsBody(draft) } : {}) });
      }
      onDone();
    } catch {
      setFailed(true);
    }
  }

  return (
    <form className="flex min-h-0 flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate aria-label={field ? t("crm.fields.editTitle") : t("crm.fields.addTitle")}>
      <TextField
        label={t("crm.fields.name")}
        value={draft.name}
        error={problems.name ? t(problems.name) : undefined}
        autoFocus
        onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="lead-field-type">{t("crm.fields.type")}</Label>
        <Select value={draft.type} onValueChange={(type) => changeType(type as LeadFieldType)} disabled={Boolean(field)}>
          <SelectTrigger id="lead-field-type" className="h-8 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LEAD_FIELD_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{t(`crm.fields.type.${type}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field ? <p className="text-xs text-muted-foreground">{t("crm.fields.typeFixed")}</p> : null}
      </div>
      {isListField(draft.type) ? (
        <OptionsEditor
          options={draft.options}
          error={problems.options ? t(problems.options) : undefined}
          onChange={(options) => setDraft((current) => ({ ...current, options }))}
        />
      ) : null}
      {failed ? <p role="alert" className="text-sm text-destructive">{t("crm.fields.saveFailed")}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>{t("crm.fields.back")}</Button>
        <Button type="submit" disabled={pending}>{field ? t("crm.fields.save") : t("crm.fields.create")}</Button>
      </div>
    </form>
  );
}
