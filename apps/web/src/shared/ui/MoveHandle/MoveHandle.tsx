import { GripHorizontal } from "lucide-react";
import { cn } from "@/shared/lib/utils.js";

export type MoveStep = -1 | 1;

export interface TileMove {
  label: string;
  hint: string;
  onStep: (step: MoveStep) => void;
}

const STEPS: Partial<Record<string, MoveStep>> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

export function MoveHandle({ label, hint, onStep, className }: TileMove & { className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint}
      onKeyDown={(event) => {
        const step = STEPS[event.key];
        if (step === undefined) return;
        event.preventDefault();
        onStep(step);
      }}
      className={cn(
        "absolute left-1/2 top-0.5 grid h-3.5 w-8 -translate-x-1/2 cursor-grab place-items-center rounded-sm text-muted-foreground",
        "opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/tile:opacity-100",
        className,
      )}
    >
      <GripHorizontal aria-hidden className="size-3.5" />
    </button>
  );
}
