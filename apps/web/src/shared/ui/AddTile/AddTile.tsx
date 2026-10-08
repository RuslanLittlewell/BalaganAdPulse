import type { CSSProperties, Ref } from "react";
import { PlusIcon } from "lucide-react";
import { cn, useTheme, type Theme } from "@/shared/lib/index.js";
import { BorderGlow } from "../BorderGlow/index.js";

const GLOW: Record<Theme, { surface: string; glow: string; colors: string[] }> = {
  light: { surface: "#FFFFFF", glow: "175 77 35", colors: ["#0F766E", "#14B8A6", "#5EEAD4"] },
  dark: { surface: "#1a2438", glow: "33 40 61", colors: ["#c4a074", "#e0c49a", "#8a6a45"] },
};

export interface AddTileProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

export function AddTile({ label, onClick, disabled = false, className, style, ref }: AddTileProps) {
  const glow = GLOW[useTheme()];
  return (
    <BorderGlow
      ref={ref}
      style={style}
      backgroundColor={glow.surface}
      glowColor={glow.glow}
      colors={glow.colors}
      className={cn(
        "group min-h-24 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:text-primary",
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
        className="grid flex-1 place-items-center outline-none"
      >
        <PlusIcon
          aria-hidden
          className="size-6 transition-transform duration-200 group-hover:scale-125 motion-reduce:transition-none"
        />
      </button>
    </BorderGlow>
  );
}
