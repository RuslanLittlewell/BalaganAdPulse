import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide";
import { MorphIcon } from "morphicons/react";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { Button } from "../ui/button.js";

/** How long the tick stays before the button offers the copy again. */
const CONFIRM_MS = 2000;

export interface CopyButtonProps {
  value: string;
  label: string;
  className?: string;
  /** How long the tick stays. Shortened by tests so they need no fake timers,
   * which stall the polling the assertions do. */
  confirmMs?: number;
}

/**
 * Copies a value and confirms it on the button itself.
 *
 * The confirmation is the icon: the copy sheets morph into a tick rather than
 * being swapped, which is what makes the change read as *this* button having
 * done something instead of a different button appearing in its place. It
 * reverts on its own, because a tick that stays becomes part of the furniture
 * and stops meaning "just now".
 */
export function CopyButton({
  value, label, className, confirmMs = CONFIRM_MS,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The tick outlives a short-lived dialog easily; without this the revert
  // would land on a component that is gone.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function copy() {
    // Absent over plain HTTP and in some embedded browsers. Nothing was
    // copied, so nothing is confirmed.
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), confirmMs);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        data-copied={copied ? "true" : "false"}
        className={cn(copied && "text-emerald-600 dark:text-emerald-400", className)}
        onClick={copy}
      >
        <MorphIcon icon={copied ? Check : Copy} size={16} spring="snappy" />
      </Button>
      {/* The colour and the shape are the confirmation for anyone who can see
          them; this is the same news for anyone who cannot. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? t("action.copied") : ""}
      </span>
    </>
  );
}
