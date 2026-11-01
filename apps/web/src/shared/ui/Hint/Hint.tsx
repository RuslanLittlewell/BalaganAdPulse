import type { ReactNode } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button } from "../Button/Button.js";

export interface HintProps {
  open: boolean;
  text: string;
  onDismiss: () => void;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}

const keepOpen = (event: Event) => event.preventDefault();

export function Hint({ open, text, onDismiss, side = "bottom", children }: HintProps) {
  return (
    <PopoverPrimitive.Root open={open}>
      <PopoverPrimitive.Anchor asChild>{children}</PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          role="status"
          side={side}
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={keepOpen}
          onCloseAutoFocus={keepOpen}
          onInteractOutside={keepOpen}
          onEscapeKeyDown={keepOpen}
          className="z-50 flex max-w-51 items-start gap-2 rounded-lg bg-primary py-2 pr-1 pl-2 text-sm font-medium text-primary-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <p className="py-1">{text}</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("hint.dismiss")}
            className="size-6 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
            onClick={onDismiss}
          >
            <XIcon />
          </Button>
          <PopoverPrimitive.Arrow className="fill-primary" width={14} height={7} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
