import { useRef, useState, type ReactNode } from "react";
import { t, type MessageKey } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";

export interface InlineTextProps {
  labelId: string;
  value: string;
  display?: ReactNode;
  editable: boolean;
  multiline?: boolean;
  inputMode?: "decimal" | "tel" | "email" | "url" | "text";
  validate?: (value: string) => MessageKey | null;
  normalize?: (value: string) => string | null;
  onSave: (value: string | null) => Promise<boolean>;
}

const EDITOR = "w-full min-w-0 rounded-md border border-ring bg-background px-2 py-1 text-sm outline-none";

const trimmed = (value: string) => {
  const text = value.trim();
  return text === "" ? null : text;
};

export function InlineText({
  labelId, value, display, editable, multiline = false, inputMode = "text", validate, normalize = trimmed, onSave,
}: InlineTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const busy = useRef(false);

  function start() {
    setDraft(value);
    setProblem(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(value);
    setProblem(null);
    setEditing(false);
  }

  async function commit() {
    if (busy.current) return;
    const found = validate?.(draft) ?? null;
    setProblem(found);
    if (found) return;
    const next = normalize(draft);
    if (next === (normalize(value) ?? null)) {
      setEditing(false);
      return;
    }
    busy.current = true;
    const saved = await onSave(next);
    busy.current = false;
    if (!saved) setDraft(value);
    setEditing(false);
  }

  if (!editable) {
    return (
      <span aria-labelledby={labelId} className="block min-w-0 truncate px-2 py-1 text-sm">
        {display ?? (value || <span className="text-muted-foreground/60">{t("crm.panel.empty")}</span>)}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        aria-labelledby={labelId}
        onClick={start}
        className="block w-full min-w-0 truncate rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
      >
        {value ? display ?? value : <span className="text-muted-foreground/60">{t("crm.panel.empty")}</span>}
      </button>
    );
  }

  const shared = {
    autoFocus: true,
    "aria-labelledby": labelId,
    "aria-invalid": problem ? true : undefined,
    value: draft,
    onBlur: () => { void commit(); },
  } as const;

  return (
    <div className="min-w-0">
      {multiline ? (
        <textarea
          {...shared}
          rows={4}
          className={cn(EDITOR, "min-h-22 resize-y")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
          }}
        />
      ) : (
        <input
          {...shared}
          inputMode={inputMode === "text" ? undefined : inputMode}
          className={EDITOR}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); void commit(); }
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
          }}
        />
      )}
      {problem ? <p role="alert" className="px-2 pt-1 text-xs text-destructive">{t(problem)}</p> : null}
    </div>
  );
}
