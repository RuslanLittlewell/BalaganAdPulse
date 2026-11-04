import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/index.js";
import { MenuSearch, MenuSearchEmpty, matchesSearch } from "../MenuSearch/MenuSearch.js";
import { selectTriggerClassName } from "../ui/select.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.js";

export interface MultiSelectItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface MultiSelectProps {
  items: MultiSelectItem[];
  chosen: readonly string[];
  onChange: (chosen: string[]) => void;
  placeholder: string;
  ariaLabel: string;
  allLabel?: string;
  searchable?: boolean;
  className?: string;
}

export function MultiSelect({
  items,
  chosen,
  onChange,
  placeholder,
  ariaLabel,
  allLabel,
  searchable = false,
  className,
}: MultiSelectProps) {
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  const shownItems = items.filter((item) => matchesSearch(item.label, query));
  const picked = items.filter((item) => chosen.includes(item.value));
  const [first, ...rest] = picked;

  const allChosen = items.length > 0 && items.every((item) => chosen.includes(item.value));

  const toggleAll = () => onChange(allChosen ? [] : items.map((item) => item.value));

  const toggle = (value: string) =>
    onChange(
      chosen.includes(value)
        ? chosen.filter((held) => held !== value)
        : [...chosen, value],
    );

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setQuery(""); }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          data-size="default"
          data-placeholder={first ? undefined : ""}
          className={cn(selectTriggerClassName, "min-w-0", className)}
        >
          <span className="flex min-w-0 items-center gap-1">
            {first?.icon ? <span aria-hidden className="shrink-0">{first.icon}</span> : null}
            <span className="truncate">{first?.label ?? placeholder}</span>
            {rest.length > 0 ? (
              <span className="shrink-0 text-muted-foreground">{`+${rest.length}`}</span>
            ) : null}
          </span>
          <ChevronDown aria-hidden className="size-3 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-77 overflow-y-auto">
        {searchable ? <MenuSearch value={query} onChange={setQuery} /> : null}
        {allLabel && !searching ? (
          <>
            <DropdownMenuCheckboxItem
              checked={allChosen}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={toggleAll}
            >
              <span className="truncate">{allLabel}</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {shownItems.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.value}
            checked={chosen.includes(item.value)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => toggle(item.value)}
          >
            <span className="flex min-w-0 items-center gap-2">
              {item.icon ? <span aria-hidden className="shrink-0">{item.icon}</span> : null}
              <span className="truncate">{item.label}</span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        {searchable && shownItems.length === 0 ? <MenuSearchEmpty /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
