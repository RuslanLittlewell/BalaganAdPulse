import { useEffect, useRef, useState } from "react";
import type { DocumentChange } from "@/entities/project-document/index.js";
import { ApiError } from "@/shared/lib/http.js";

export type SaveStatus = "idle" | "saving" | "saved" | "failed" | "conflict";
export const AUTOSAVE_DELAY_MS = 800;

type Draft = { change: DocumentChange; revision: number; writer: string };

function readDraft(key: string | undefined): Draft | undefined {
  if (!key) return;
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
    if (draft && Number.isInteger(draft.revision) && draft.revision > 0
      && draft.change && typeof draft.change === "object" && !Array.isArray(draft.change)) return draft;
  } catch {}
}

export function useAutosave(
  save: (change: DocumentChange, revision: number) => Promise<{ revision: number }>,
  options: { revision: number; storageKey?: string },
) {
  const [restored] = useState(() => readDraft(options.storageKey));
  const [status, setStatus] = useState<SaveStatus>(restored ? "saving" : "idle");
  const [storageFailed, setStorageFailed] = useState(false);
  const pending = useRef<DocumentChange>(restored?.change ?? {});
  const revision = useRef(restored?.revision ?? options.revision);
  const sending = useRef<DocumentChange>({});
  const active = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const blocked = useRef(false);
  const discarded = useRef(false);
  const writer = useRef(crypto.randomUUID());
  const saveRef = useRef(save);
  saveRef.current = save;

  const persist = () => {
    if (!options.storageKey) return;
    try {
      if (!mounted.current && readDraft(options.storageKey)?.writer !== writer.current) return;
      const change = { ...sending.current, ...pending.current };
      if (Object.keys(change).length === 0) localStorage.removeItem(options.storageKey);
      else localStorage.setItem(options.storageKey, JSON.stringify({ change, revision: revision.current, writer: writer.current }));
      if (mounted.current) setStorageFailed(false);
    } catch {
      if (mounted.current) setStorageFailed(true);
    }
  };

  const flush = (): Promise<void> => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (active.current) return active.current;
    if (blocked.current || discarded.current) return Promise.resolve();
    const change = { ...pending.current };
    if (change.title !== undefined && change.title.trim().length === 0) {
      if (mounted.current) setStatus("failed");
      return Promise.resolve();
    }
    if (Object.keys(change).length === 0) return Promise.resolve();
    pending.current = {};
    sending.current = change;
    persist();
    if (mounted.current) setStatus("saving");
    let succeeded = false;
    const work = Promise.resolve().then(() => saveRef.current(change, revision.current)).then(
      (saved) => {
        if (discarded.current) return;
        succeeded = true;
        revision.current = saved.revision;
        sending.current = {};
        persist();
        if (mounted.current) setStatus(Object.keys(pending.current).length > 0 ? "saving" : "saved");
      },
      (error: unknown) => {
        if (discarded.current) return;
        pending.current = { ...change, ...pending.current };
        sending.current = {};
        blocked.current = error instanceof ApiError && error.status === 409;
        persist();
        if (mounted.current) setStatus(blocked.current ? "conflict" : "failed");
      },
    ).finally(() => {
      active.current = null;
      if (succeeded && !discarded.current && Object.keys(pending.current).length > 0) {
        if (mounted.current) timer.current = setTimeout(() => { void flushRef.current(); }, AUTOSAVE_DELAY_MS);
        else void flushRef.current();
      }
    });
    active.current = work;
    return work;
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;

  const schedule = (change: DocumentChange) => {
    discarded.current = false;
    pending.current = { ...pending.current, ...change };
    persist();
    if (blocked.current) return;
    setStatus("saving");
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flushRef.current(); }, AUTOSAVE_DELAY_MS);
  };

  const discard = () => {
    discarded.current = true;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = {};
    sending.current = {};
    persist();
  };

  useEffect(() => {
    mounted.current = true;
    if (Object.keys(pending.current).length > 0) {
      persist();
      timer.current = setTimeout(() => { void flushRef.current(); }, AUTOSAVE_DELAY_MS);
    }
    const depart = () => { persist(); void flushRef.current(); };
    const visibility = () => { if (document.visibilityState === "hidden") depart(); };
    const online = () => { if (!blocked.current) void flushRef.current(); };
    window.addEventListener("pagehide", depart);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      persist();
      mounted.current = false;
      void flushRef.current();
      window.removeEventListener("pagehide", depart);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const retry = (expectedRevision?: number) => {
    if (expectedRevision !== undefined) revision.current = expectedRevision;
    blocked.current = false;
    discarded.current = false;
    return flushRef.current();
  };

  return { status, storageFailed, initialChange: restored?.change, schedule, discard, retry };
}
