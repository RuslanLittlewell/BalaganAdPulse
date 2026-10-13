import type { ReactNode } from "react";
import { Button } from "../Button/Button.js";
import WarmTooltip from "../WarmTooltip/WarmTooltip.js";

export function EditorToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <WarmTooltip content={label} side="bottom" disabled={disabled}>
      <Button
        type="button"
        variant={active ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
    </WarmTooltip>
  );
}
