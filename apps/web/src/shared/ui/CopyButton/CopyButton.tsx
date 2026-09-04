import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide";
import { MorphIcon } from "morphicons/react";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { Button } from "../ui/button.js";

const CONFIRM_MS = 2000;

export interface CopyButtonProps {
  value: string;
  label: string;
  className?: string;
  confirmMs?: number;
}

export function CopyButton({
  value, label, className, confirmMs = CONFIRM_MS,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function copy() {
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
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? t("action.copied") : ""}
      </span>
    </>
  );
}
