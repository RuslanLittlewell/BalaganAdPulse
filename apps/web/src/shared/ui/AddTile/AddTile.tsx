import type { CSSProperties, Ref } from "react";
import { PlusIcon } from "lucide-react";
import { cn } from "@/shared/lib/index.js";

export interface AddTileProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

export function AddTile({ label, onClick, disabled = false, className, style, ref }: AddTileProps) {
  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "grid min-h-19 rounded-lg border-2 border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="grid place-items-center outline-none"
      >
        <PlusIcon aria-hidden className="size-5" />
      </button>
    </div>
  );
}
