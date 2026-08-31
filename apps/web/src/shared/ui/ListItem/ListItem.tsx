import type { ReactNode } from "react";
import { PencilIcon } from "lucide-react";
import { Button } from "../ui/button.js";

/**
 * The row owns its background; the controls inside it must not paint their own,
 * or hovering the row shows a lighter rectangle inside a darker one.
 *
 * Both themes have to be named. `twMerge` drops the ghost variant's
 * `hover:bg-accent` when this overrides it, but `dark:hover:bg-accent/50` is a
 * different variant chain and survives — which is exactly the seam that showed.
 */
const NO_OWN_HOVER = "hover:bg-transparent dark:hover:bg-transparent";

export interface ListItemProps {
  selected?: boolean;
  leading?: ReactNode;
  onClick?: () => void;
  onEdit?: () => void;
  editLabel?: string;
  /** A CSS colour drawn as a stripe down the leading edge of the row, and as
   *  a hairline under it. Rows without one keep the same borders in transparent,
   *  so every row is the same height either way. */
  marker?: string;
  /** What the stripe stands for, for anyone who cannot see it. */
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
      className="group flex min-w-0 mb-1 items-center rounded-md border-b border-l-4 border-transparent pr-2 transition-colors hover:bg-accent/60 data-[selected=true]:bg-accent"
      data-selected={selected}
      style={
        marker != null
          ? { borderLeftColor: marker, borderBottomColor: marker }
          : undefined
      }
    >
      {markerLabel != null && <span className="sr-only">{markerLabel}</span>}
      <Button
        variant="ghost"
        className={`h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2 font-normal ${NO_OWN_HOVER}`}
        data-selected={selected}
        onClick={onClick}
      >
        {leading != null && (
          <span className="shrink-0" aria-hidden="true">
            {leading}
          </span>
        )}
        <span className="min-w-0 flex-1 text-left">{children}</span>
      </Button>
      {onEdit != null && (
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
