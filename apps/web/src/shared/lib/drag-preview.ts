import { useCallback, useEffect, useState } from "react";

interface Preview<T> {
  readonly draggingId: string | null;
  readonly basis: readonly T[] | undefined;
  readonly board: T[];
}

export function useDragPreview<T>(items: T[] | undefined) {
  const [preview, setPreview] = useState<Preview<T> | null>(null);

  useEffect(() => {
    setPreview((current) =>
      current && current.draggingId === null && current.basis !== items ? null : current);
  }, [items]);

  const holding = preview != null && (preview.draggingId !== null || preview.basis === items);

  const start = useCallback((id: string) => {
    setPreview({ draggingId: id, basis: items, board: [...(items ?? [])] });
  }, [items]);

  const update = useCallback((next: (board: T[]) => T[]) => {
    setPreview((current) => current && { ...current, board: next(current.board) });
  }, []);

  const settle = useCallback(() => {
    setPreview((current) => current && { ...current, draggingId: null, basis: items });
  }, [items]);

  const cancel = useCallback(() => setPreview(null), []);

  const release = useCallback(() => {
    setPreview((current) => current && current.draggingId === null ? null : current);
  }, []);

  return {
    board: holding ? preview.board : items ?? [],
    previewed: holding ? preview.board : null,
    draggingId: preview?.draggingId ?? null,
    start,
    preview: update,
    settle,
    cancel,
    release,
  };
}
