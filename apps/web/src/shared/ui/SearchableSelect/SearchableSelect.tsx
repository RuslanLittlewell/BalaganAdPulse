import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "@/shared/lib/index.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.js";

export interface SearchableOption {
  value: string;
  label: string;
  node?: ReactNode;
}

export interface SearchableSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: readonly SearchableOption[];
  pinned?: readonly SearchableOption[];
  searchLabel: string;
  emptyLabel: string;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

const normalised = (text: string) => text.trim().toLocaleLowerCase("ru");

export function SearchableSelect({
  value,
  onValueChange,
  options,
  pinned = [],
  searchLabel,
  emptyLabel,
  placeholder,
  id,
  ariaLabel,
  className,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const needle = normalised(query);
  const matches = (option: SearchableOption) => needle === "" || normalised(option.label).includes(needle);
  const found = options.filter(matches);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const choose = (next: string) => {
    onValueChange(next);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") return;
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      if (found[0]) choose(found[0].value);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      content.current?.querySelector<HTMLElement>('[role="option"]:not([data-disabled])')?.focus();
    }
  };

  const item = (option: SearchableOption, visible: boolean) => (
    <SelectItem
      key={option.value}
      value={option.value}
      disabled={!visible}
      hidden={!visible}
      className={cn(!visible && "hidden")}
    >
      {option.node ?? option.label}
    </SelectItem>
  );

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent ref={content} position="popper" className="min-w-(--radix-select-trigger-width)">
        <div className="sticky top-0 z-10 border-b bg-popover p-1">
          <div className="relative">
            <SearchIcon aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={input}
              type="search"
              value={query}
              placeholder={searchLabel}
              aria-label={searchLabel}
              autoComplete="off"
              className="h-7 w-full rounded-md border border-input bg-transparent pl-6 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
        {pinned.map((option) => item(option, needle === ""))}
        {options.map((option) => item(option, matches(option)))}
        {found.length === 0 ? (
          <p role="status" className="px-2 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : null}
      </SelectContent>
    </Select>
  );
}
