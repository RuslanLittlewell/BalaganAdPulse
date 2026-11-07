import { Search } from "lucide-react";
import type { LeadField } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { Button } from "@/shared/ui/index.js";
import { DEFAULT_VIEW, type Filter, type ViewState } from "../model/viewState.js";
import { AddFilterButton, FilterChip, type FilterContext } from "./FilterControls.js";
import { OptionsMenu, type Layout } from "./OptionsMenu.js";
import { SortButton, SortChip } from "./SortControls.js";

export interface CrmViewControlsProps {
  view: ViewState;
  context: FilterContext;
  layout?: Layout;
  columns?: boolean;
  canManageFields: boolean;
  onChange: (change: Partial<ViewState>) => void;
  onAddFilter: (filter: Filter) => void;
  onLayout?: (layout: Layout) => void;
  onBoardFields?: () => void;
}

export function CrmViewControls({
  view, context, layout, columns, canManageFields, onChange, onAddFilter, onLayout, onBoardFields,
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
        layout={layout}
        columns={columns}
        canManageFields={canManageFields}
        onChange={onChange}
        onLayout={onLayout}
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

export function CrmViewChips({ view, context, freshId, fields, onChange }: CrmViewChipsProps) {
  const active = view.filters.length > 0 || view.sort !== null || view.search.trim() !== "";
  if (!active) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={t("crm.view.filter")} role="group">
      {view.sort ? <SortChip sort={view.sort} fields={fields} catalogue={context.catalogue} onRemove={() => onChange({ sort: null })} /> : null}
      {view.filters.map((filter) => (
        <FilterChip
          key={filter.id}
          filter={filter}
          context={context}
          startOpen={filter.id === freshId}
          onChange={(next) => onChange({ filters: view.filters.map((item) => (item.id === filter.id ? next : item)) })}
          onRemove={() => onChange({ filters: view.filters.filter((item) => item.id !== filter.id) })}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={() => onChange({ filters: DEFAULT_VIEW.filters, sort: DEFAULT_VIEW.sort, search: DEFAULT_VIEW.search })}
      >
        {t("crm.view.reset")}
      </Button>
    </div>
  );
}
