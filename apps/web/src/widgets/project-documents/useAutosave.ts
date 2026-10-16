import { useEffect, useRef, useState } from "react";
import type { DocumentChange } from "@/entities/project-document/index.js";

export type SaveStatus = "idle" | "saving" | "saved" | "failed";

export const AUTOSAVE_DELAY_MS = 800;

export function useAutosave(save: (change: DocumentChange) => Promise<unknown>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const pending = useRef<DocumentChange>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const mounted = useRef(true);

  const flush = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    const change = pending.current;
    pending.current = {};
    if (change.title !== undefined && change.title.trim().length === 0) delete change.title;
    if (Object.keys(change).length === 0) return;
    if (mounted.current) setStatus("saving");
    saveRef.current(change).then(
      () => { if (mounted.current) setStatus("saved"); },
      () => { if (mounted.current) setStatus("failed"); },
    );
  };

  const schedule = (change: DocumentChange) => {
    pending.current = { ...pending.current, ...change };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  };

  const discard = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = {};
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      flushRef.current();
    };
  }, []);

  return { status, schedule, discard };
}
