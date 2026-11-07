import { ArrowDownUp, X } from "lucide-react";
import type { LeadField } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/index.js";
import { catalogueField, fieldCatalogue, type CatalogueField } from "../lib/catalogue.js";
import type { FieldRef, Sort, SortDirection } from "../model/viewState.js";

const MANUAL = "__manual__";

export function SortButton({ sort, fields, catalogue, onChange }: { sort: Sort | null; fields: readonly LeadField[]; catalogue?: readonly CatalogueField[]; onChange: (sort: Sort | null) => void }) {
  const sortable = (catalogue ?? fieldCatalogue(fields)).filter((field) => field.sortable);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="h-8 gap-1 px-2 text-sm">
          <ArrowDownUp aria-hidden className="size-3.5" />
          {t("crm.view.sort")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={sort?.field ?? MANUAL}
          onValueChange={(value) => onChange(value === MANUAL ? null : { field: value as FieldRef, direction: sort?.direction ?? "asc" })}
        >
          <DropdownMenuRadioItem value={MANUAL}>{t("crm.view.manual")}</DropdownMenuRadioItem>
          {sortable.map((field) => <DropdownMenuRadioItem key={field.ref} value={field.ref}>{field.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        {sort ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t("crm.view.sort")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort.direction} onValueChange={(direction) => onChange({ ...sort, direction: direction as SortDirection })}>
              <DropdownMenuRadioItem value="asc">{t("crm.view.asc")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">{t("crm.view.desc")}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SortChip({ sort, fields, catalogue, onRemove }: { sort: Sort; fields: readonly LeadField[]; catalogue?: readonly CatalogueField[]; onRemove: () => void }) {
  const field = catalogue?.find((entry) => entry.ref === sort.field) ?? catalogueField(sort.field, fields);
  if (!field) return null;
  const label = `${t("crm.view.sort")}: ${field.label}, ${t(sort.direction === "asc" ? "crm.view.asc" : "crm.view.desc").toLowerCase()}`;
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted/40 text-xs" data-sort={sort.field}>
      <span className="px-2 py-1">{label}</span>
      <button type="button" aria-label={t("crm.view.removeSort")} className="px-1 py-1 text-muted-foreground hover:text-foreground" onClick={onRemove}>
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}
