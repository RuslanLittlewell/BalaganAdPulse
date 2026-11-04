import type { KeyboardEvent } from "react";
import { SearchIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";

export function matchesSearch(label: string, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("ru");
  return needle === "" || label.toLocaleLowerCase("ru").includes(needle);
}

function keepTyping(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Escape") return;
  event.stopPropagation();
  if (event.key !== "ArrowDown") return;
  event.preventDefault();
  event.currentTarget
    .closest('[role="menu"]')
    ?.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')
    ?.focus();
}

export interface MenuSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearch({ value, onChange }: MenuSearchProps) {
  return (
    <div className="sticky top-0 z-10 -mt-1 mb-1 border-b bg-popover p-1">
      <div className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          autoFocus
          value={value}
          placeholder={t("select.search")}
          aria-label={t("select.search")}
          autoComplete="off"
          className="h-7 w-full rounded-md border border-input bg-transparent pl-6 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={keepTyping}
        />
      </div>
    </div>
  );
}

export function MenuSearchEmpty() {
  return <p role="status" className="px-2 py-2 text-sm text-muted-foreground">{t("select.search.empty")}</p>;
}
