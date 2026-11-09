import { Search } from "lucide-react";
import type { LeadField } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import type { Filter, ViewState } from "../model/viewState.js";
import { AddFilterButton, FilterChip, type FilterContext } from "./FilterControls.js";
import { OptionsMenu } from "./OptionsMenu.js";
import { SortButton, SortChip } from "./SortControls.js";

export interface CrmViewControlsProps {
  view: ViewState;
  context: FilterContext;
  columns?: boolean;
  canManageFields: boolean;
  onChange: (change: Partial<ViewState>) => void;
  onAddFilter: (filter: Filter) => void;
  onBoardFields?: () => void;
}

export function CrmViewControls({
  view, context, columns, canManageFields, onChange, onAddFilter, onBoardFields,
}: CrmViewControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <label className="flex h-8 items-center gap-1.5 rounded-md border border-input px-2 focus-within:border-ring">
        <Search aria-hidden className="size-3.5 text-muted-foreground" />
        <input
          type="search"
          aria-label={t("crm.view.search")}
          placeholder={t("crm.view.search")}
          className="w-36 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          value={view.search}
          onChange={(event) => onChange({ search: event.target.value })}
        />
      </label>
      <AddFilterButton context={context} onAdd={onAddFilter} />
      <SortButton sort={view.sort} fields={context.fields} catalogue={context.catalogue} onChange={(sort) => onChange({ sort })} />
      <OptionsMenu
        view={view}
        fields={context.fields}
        catalogue={context.catalogue}
        columns={columns}
        canManageFields={canManageFields}
        onChange={onChange}
        onBoardFields={onBoardFields}
      />
    </div>
  );
}

export interface CrmViewChipsProps {
  view: ViewState;
  context: FilterContext;
  freshId: string | null;
  fields: readonly LeadField[];
  onChange: (change: Partial<ViewState>) => void;
}

const isHeaderPeriod = (filter: Filter) => filter.field === "arrival" && filter.operator === "between";

export function CrmViewChips({ view, context, freshId, fields, onChange }: CrmViewChipsProps) {
  const active = view.filters.length > 0 || view.sort !== null || view.search.trim() !== "";
  if (!active) return null;
  return (
    <>
      {view.sort ? <SortChip sort={view.sort} fields={fields} catalogue={context.catalogue} onRemove={() => onChange({ sort: null })} /> : null}
      {view.filters.filter((filter) => !isHeaderPeriod(filter)).map((filter) => (
        <FilterChip
          key={filter.id}
          filter={filter}
          context={context}
          startOpen={filter.id === freshId}
          onChange={(next) => onChange({ filters: view.filters.map((item) => (item.id === filter.id ? next : item)) })}
          onRemove={() => onChange({ filters: view.filters.filter((item) => item.id !== filter.id) })}
        />
      ))}
    </>
  );
}
