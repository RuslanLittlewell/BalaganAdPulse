import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils.js";
import type { SortDirection } from "@/shared/lib/tableSort.js";
import { t } from "@/shared/config/index.js";

export interface SortButtonProps {
  label: string;
  direction: SortDirection | null;
  onSort: () => void;
  align?: "start" | "end";
  className?: string;
}

export function SortButton({ label, direction, onSort, align = "start", className }: SortButtonProps) {
  const Icon = direction === "asc" ? ArrowUpIcon : direction === "desc" ? ArrowDownIcon : ChevronsUpDownIcon;
  return (
    <button
      type="button"
      title={`${t("table.sortBy")} «${label}»`}
      onClick={onSort}
      className={cn(
        "group/sort flex w-full min-w-0 items-center gap-1 rounded font-[inherit] text-inherit hover:text-primary focus-visible:outline-2 focus-visible:outline-ring",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <Icon
        aria-hidden
        className={cn(
          "size-3 shrink-0",
          direction === null && "opacity-0 transition-opacity group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60",
        )}
      />
    </button>
  );
}
