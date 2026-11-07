import { useState } from "react";
import { ListFilter, X } from "lucide-react";
import { leadColumnLabel, type LeadColumn, type LeadField } from "@/entities/lead/index.js";
import { t, type MessageKey } from "@/shared/config/index.js";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";
import { catalogueField, fieldCatalogue, needsValue, operatorsFor, type CatalogueField, type FieldKind } from "../lib/catalogue.js";
import type { Filter, FilterValue, Operator } from "../model/viewState.js";

export interface Choice {
  id: string;
  label: string;
}

export interface FilterContext {
  fields: readonly LeadField[];
  catalogue?: readonly CatalogueField[];
  columns: readonly LeadColumn[];
  assignees: readonly Choice[];
  tags: readonly string[];
}

const LIST_KINDS: readonly FieldKind[] = ["stage", "member", "choice", "choices", "tags"];

export function operatorLabel(kind: FieldKind, operator: Operator): string {
  if ((kind === "tags" || kind === "choices") && operator === "anyOf") return t("crm.view.op.tagsAnyOf");
  if ((kind === "tags" || kind === "choices") && operator === "noneOf") return t("crm.view.op.tagsNoneOf");
  return t(`crm.view.op.${operator}` as MessageKey);
}

export function choicesOf(field: CatalogueField, context: FilterContext): Choice[] {
  switch (field.kind) {
    case "stage": return context.columns.map((column) => ({ id: column.id, label: leadColumnLabel(column) }));
    case "member": return [...context.assignees];
    case "tags": return context.tags.map((tag) => ({ id: tag, label: tag }));
    case "choice": case "choices": return field.options.map((option) => ({ id: option.id, label: option.name }));
    default: return [];
  }
}

function dayLabel(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function filterLabel(filter: Filter, context: FilterContext): string {
  const field = context.catalogue?.find((entry) => entry.ref === filter.field) ?? catalogueField(filter.field, context.fields);
  if (!field) return "";
  const head = `${field.label}: ${operatorLabel(field.kind, filter.operator)}`;
  if (!needsValue(filter.operator) || filter.value === null) return head;
  if (Array.isArray(filter.value)) {
    const names = choicesOf(field, context).filter((choice) => (filter.value as string[]).includes(choice.id)).map((choice) => choice.label);
    return names.length > 0 ? `${head} ${names.join(", ")}` : head;
  }
  const shown = field.kind === "arrival" || field.kind === "date" ? dayLabel(filter.value) : filter.value;
  return filter.value ? `${head} ${shown}` : head;
}

function ValueEditor({ field, filter, context, onChange }: {
  field: CatalogueField; filter: Filter; context: FilterContext; onChange: (value: FilterValue) => void;
}) {
  if (!needsValue(filter.operator)) return null;
  const id = `filter-value-${filter.id}`;
  if (LIST_KINDS.includes(field.kind)) {
    const chosen = Array.isArray(filter.value) ? filter.value : [];
    const choices = choicesOf(field, context);
    return (
      <fieldset className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        <legend className="mb-1 text-xs text-muted-foreground">{t("crm.view.value")}</legend>
        {choices.length === 0 ? <p className="text-xs text-muted-foreground">{t("crm.view.noFields")}</p> : null}
        {choices.map((choice) => (
          <label key={choice.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={chosen.includes(choice.id)}
              onChange={(event) => onChange(event.target.checked ? [...chosen, choice.id] : chosen.filter((item) => item !== choice.id))}
            />
            <span className="truncate">{choice.label}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  const value = typeof filter.value === "string" ? filter.value : "";
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{t("crm.view.value")}</Label>
      <Input
        id={id}
        className="h-8"
        type={field.kind === "arrival" || field.kind === "date" ? "date" : "text"}
        inputMode={field.kind === "number" ? "decimal" : undefined}
        value={value}
        onChange={(event) => onChange(field.kind === "number" ? event.target.value.replace(/[\s ]/g, "").replace(",", ".") : event.target.value)}
      />
    </div>
  );
}

export function FilterEditor({ filter, context, onChange }: { filter: Filter; context: FilterContext; onChange: (filter: Filter) => void }) {
  const field = context.catalogue?.find((entry) => entry.ref === filter.field) ?? catalogueField(filter.field, context.fields);
  if (!field) return null;
  const operatorId = `filter-operator-${filter.id}`;
  return (
    <div className="flex w-64 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={operatorId}>{t("crm.view.chooseOperator")}</Label>
        <Select
          value={filter.operator}
          onValueChange={(operator) => onChange({ ...filter, operator: operator as Operator, value: needsValue(operator as Operator) ? filter.value : null })}
        >
          <SelectTrigger id={operatorId} className="h-8 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {operatorsFor(field.kind).map((operator) => (
              <SelectItem key={operator} value={operator}>{operatorLabel(field.kind, operator)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ValueEditor field={field} filter={filter} context={context} onChange={(value) => onChange({ ...filter, value })} />
    </div>
  );
}

let sequence = 0;

export function AddFilterButton({ context, onAdd }: { context: FilterContext; onAdd: (filter: Filter) => void }) {
  const fields = context.catalogue ?? fieldCatalogue(context.fields);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="h-8 gap-1 px-2 text-sm">
          <ListFilter aria-hidden className="size-3.5" />
          {t("crm.view.filter")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto" onCloseAutoFocus={(event) => event.preventDefault()}>
        {fields.map((field) => (
          <DropdownMenuItem
            key={field.ref}
            onSelect={() => onAdd({ id: `filter-${Date.now().toString(36)}-${++sequence}`, field: field.ref, operator: operatorsFor(field.kind)[0]!, value: null })}
          >
            {field.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilterChip({ filter, context, startOpen = false, onChange, onRemove }: {
  filter: Filter; context: FilterContext; startOpen?: boolean; onChange: (filter: Filter) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <span className="inline-flex max-w-full items-center rounded-md border border-border bg-muted/40 text-xs" data-filter={filter.field}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="max-w-72 truncate px-2 py-1 text-left hover:text-foreground">{filterLabel(filter, context)}</button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <FilterEditor filter={filter} context={context} onChange={onChange} />
        </PopoverContent>
      </Popover>
      <button type="button" aria-label={`${t("crm.view.removeFilter")}: ${filterLabel(filter, context)}`} className="px-1 py-1 text-muted-foreground hover:text-foreground" onClick={onRemove}>
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}
