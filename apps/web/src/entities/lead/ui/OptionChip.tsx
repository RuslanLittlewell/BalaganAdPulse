import { cn } from "@/shared/lib/index.js";
import type { OptionColor } from "../api/api.js";

export const OPTION_CHIP_CLASS: Record<OptionColor, string> = {
  gray: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  yellow: "bg-amber-400/25 text-amber-800 dark:text-amber-200",
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  teal: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  blue: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  purple: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};

const SWATCH: Record<OptionColor, string> = {
  gray: "bg-slate-400",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-amber-400",
  green: "bg-emerald-500",
  teal: "bg-teal-500",
  blue: "bg-sky-500",
  purple: "bg-violet-500",
};

export function OptionChip({ name, color, className }: { name: string; color: OptionColor; className?: string }) {
  return (
    <span
      data-color={color}
      className={cn("inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium", OPTION_CHIP_CLASS[color], className)}
    >
      {name}
    </span>
  );
}

export function OptionSwatch({ color, className }: { color: OptionColor; className?: string }) {
  return <span aria-hidden data-color={color} className={cn("inline-block size-3 shrink-0 rounded-full", SWATCH[color], className)} />;
}

export function ColumnPill({ name, color, className }: { name: string; color: OptionColor; className?: string }) {
  return (
    <span
      data-color={color}
      className={cn("inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-xs font-medium", OPTION_CHIP_CLASS[color], className)}
    >
      {name}
    </span>
  );
}
