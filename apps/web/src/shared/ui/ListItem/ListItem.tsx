import type { ReactNode } from "react";
import { PencilIcon } from "lucide-react";
import { Button } from "../ui/button.js";

const NO_OWN_HOVER = "hover:bg-transparent dark:hover:bg-transparent";

export interface ListItemProps {
  selected?: boolean;
  leading?: ReactNode;
  onClick?: () => void;
  onEdit?: () => void;
  editLabel?: string;
  marker?: string;
  markerLabel?: string;
  children: ReactNode;
}

export function ListItem({
  selected = false,
  leading,
  onClick,
  onEdit,
  editLabel,
  marker,
  markerLabel,
  children,
}: ListItemProps) {
  return (
    <div
      className="group flex min-w-0 mb-1 items-center rounded-md border pr-2 transition-colors hover:bg-accent/60 data-[selected=true]:bg-accent relative"
      data-selected={selected}
    >
      <span className="absolute w-[4px] h-[75%] rounded-2xl right-1 top-1/2 -translate-y-1/2 block" style={{background: marker}}></span>
      {markerLabel && <span className="sr-only">{markerLabel}</span>}
      <Button
        variant="ghost"
        className={`h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2 font-normal ${NO_OWN_HOVER}`}
        data-selected={selected}
        onClick={onClick}
      >
        {leading && (
          <span className="shrink-0" aria-hidden="true">
            {leading}
          </span>
        )}
        <span className="min-w-0 flex-1 text-left">{children}</span>
      </Button>
      {onEdit && (
        <Button
          variant="ghost"
          size="icon-sm"
          className={`shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground ${NO_OWN_HOVER}`}
          aria-label={editLabel}
          onClick={onEdit}
        >
          <PencilIcon className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
