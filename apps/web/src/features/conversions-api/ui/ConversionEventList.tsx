import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { Button, TextField } from "@/shared/ui/index.js";
import { useLeadColumns } from "@/entities/lead/index.js";
import {
  CONVERSION_EVENT_LIMIT,
  CONVERSION_EVENT_NAME_LIMIT,
  useConversionEvents,
  useCreateConversionEvent,
  useDeleteConversionEvent,
  useUpdateConversionEvent,
  type ConversionEvent,
  type ConversionEventInput,
} from "../api/conversions.js";

const eventFailure = (error: unknown) =>
  error instanceof ApiError && error.status === 409 ? t("capi.events.error.duplicate") : t("capi.events.error.invalid");

export function ConversionEventList({ projectId }: { projectId: string }) {
  const events = useConversionEvents(projectId);
  const columns = useLeadColumns(projectId);
  const remove = useDeleteConversionEvent(projectId);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const stageName = new Map((columns.data ?? []).map((column) => [column.id, column.name]));
  const list = events.data ?? [];

  return (
    <section className="grid gap-2 border-t border-border pt-3" aria-label={t("capi.events")}>
      <h3 className="text-sm font-semibold">{t("capi.events")}</h3>
      <p className="text-xs text-muted-foreground">{t("capi.events.hint")}</p>
      {events.isError && <p role="alert" className="text-xs text-destructive">{t("capi.events.error.read")}</p>}
      {events.isSuccess && list.length === 0 && <p className="text-xs text-muted-foreground">{t("capi.events.empty")}</p>}
      <ul className="grid gap-2">
        {list.map((event) => editing === event.id ? (
          <li key={event.id}>
            <EventEditor projectId={projectId} event={event} onDone={() => setEditing(null)} />
          </li>
        ) : (
          <li key={event.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2" aria-label={event.name}>
            <div className="grid gap-0.5">
              <span className="text-sm font-medium">
                {event.name}
                {event.carriesAmount && <span className="ml-2 text-xs text-muted-foreground">{t("capi.events.amount")}</span>}
              </span>
              <span className={event.stages.length === 0 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {event.stages.length === 0 ? t("capi.events.noStages") : event.stages.map((stage) => stageName.get(stage) ?? stage).join(", ")}
              </span>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="sm" disabled={editing !== null} onClick={() => setEditing(event.id)}>
                {t("capi.events.edit")}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={remove.isPending || editing !== null} onClick={() => remove.mutate(event.id)}>
                {t("capi.events.remove")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <EventEditor projectId={projectId} onDone={() => setEditing(null)} />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          disabled={!events.isSuccess || editing !== null || list.length >= CONVERSION_EVENT_LIMIT}
          onClick={() => setEditing("new")}
        >
          {t("capi.events.add")}
        </Button>
      )}
    </section>
  );
}

function EventEditor({ projectId, event, onDone }: { projectId: string; event?: ConversionEvent; onDone: () => void }) {
  const columns = useLeadColumns(projectId);
  const create = useCreateConversionEvent(projectId);
  const update = useUpdateConversionEvent(projectId);
  const [name, setName] = useState(event?.name ?? "");
  const [stages, setStages] = useState<string[]>(event?.stages ?? []);
  const [carriesAmount, setCarriesAmount] = useState(event?.carriesAmount ?? false);
  const [failure, setFailure] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  const toggle = (stage: string, checked: boolean) =>
    setStages((current) => checked ? [...current, stage] : current.filter((candidate) => candidate !== stage));

  const submit = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setFailure(null);
    const input: ConversionEventInput = { name: name.trim(), stages, carriesAmount };
    const options = { onSuccess: onDone, onError: (error: unknown) => setFailure(eventFailure(error)) };
    if (event) update.mutate({ ...input, id: event.id }, options);
    else create.mutate(input, options);
  };

  return (
    <form className="grid gap-2 rounded-md border border-border p-2" onSubmit={submit} aria-label={t("capi.events.name")}>
      <TextField
        label={t("capi.events.name")}
        value={name}
        onChange={(change) => setName(change.target.value)}
        required
        maxLength={CONVERSION_EVENT_NAME_LIMIT}
        autoComplete="off"
        disabled={pending}
        compact
      />
      <fieldset className="grid gap-1" disabled={pending}>
        <legend className="mb-1 text-xs font-medium">{t("capi.events.stages")}</legend>
        <div className="grid grid-cols-2 gap-1">
          {(columns.data ?? []).map((column) => (
            <label key={column.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={stages.includes(column.id)}
                onChange={(change) => toggle(column.id, change.target.checked)}
              />
              {column.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={carriesAmount}
          disabled={pending}
          onChange={(change) => setCarriesAmount(change.target.checked)}
        />
        {t("capi.events.amount")}
      </label>
      {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          {t("action.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={pending || stages.length === 0}>
          {t("action.save")}
        </Button>
      </div>
    </form>
  );
}
