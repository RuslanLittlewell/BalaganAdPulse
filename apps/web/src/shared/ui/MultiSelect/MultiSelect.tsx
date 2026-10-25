import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, SearchIcon } from "lucide-react";
import { cn } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
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
  const needle = query.trim().toLocaleLowerCase("ru");
  const shownItems = needle === "" ? items : items.filter((item) => item.label.toLocaleLowerCase("ru").includes(needle));
  const stopTyping = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") event.stopPropagation();
  };
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
          <span className="flex min-w-0 items-center gap-1.5">
            {first?.icon ? <span aria-hidden className="shrink-0">{first.icon}</span> : null}
            <span className="truncate">{first?.label ?? placeholder}</span>
            {rest.length > 0 ? (
              <span className="shrink-0 text-muted-foreground">{`+${rest.length}`}</span>
            ) : null}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
        {searchable ? (
          <div className="sticky top-0 z-10 -mt-1 mb-1 border-b bg-popover p-1.5">
            <div className="relative">
              <SearchIcon aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                autoFocus
                value={query}
                placeholder={t("select.search")}
                aria-label={t("select.search")}
                autoComplete="off"
                className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={stopTyping}
              />
            </div>
          </div>
        ) : null}
        {allLabel && needle === "" ? (
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
        {searchable && shownItems.length === 0 ? (
          <p role="status" className="px-3 py-2 text-sm text-muted-foreground">{t("select.search.empty")}</p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
