import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/index.js";
import { Button } from "../Button/Button.js";
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
  className?: string;
}

export function MultiSelect({
  items,
  chosen,
  onChange,
  placeholder,
  ariaLabel,
  allLabel,
  className,
}: MultiSelectProps) {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn("h-10 min-w-0 justify-between gap-2 font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {first?.icon ? <span aria-hidden className="shrink-0">{first.icon}</span> : null}
            <span className="truncate">{first?.label ?? placeholder}</span>
            {rest.length > 0 ? (
              <span className="shrink-0 text-muted-foreground">{`+${rest.length}`}</span>
            ) : null}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
        {allLabel ? (
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
        {items.map((item) => (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
