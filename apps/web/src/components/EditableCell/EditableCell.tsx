import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./EditableCell.module.css";

export interface EditableCellProps {
  /** Formatted text shown at rest. */
  display: string;
  /** Raw text the input starts with; also the yardstick for "nothing changed". */
  value: string;
  /** Accessible name of the input — the resting button is named by its own text. */
  label: string;
  /** Whether this cell is the open one. The parent owns that, so Tab can move it. */
  editing: boolean;
  onOpen: () => void;
  /** `direction` is set when the user tabbed out: 1 forwards, -1 backwards. */
  onClose: (direction?: 1 | -1) => void;
  /** Rejecting puts the cell in its error state; the reason becomes the tooltip. */
  onSave: (raw: string) => Promise<void>;
}

export function EditableCell({
  display, value, label, editing, onOpen, onClose, onSave,
}: EditableCellProps) {
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /* Tab and blur both fire on the way out; the first one through wins. */
  const closing = useRef(false);
  const wasEditing = useRef(editing);

  useEffect(() => {
    if (!editing) return;
    // A failed edit reopens with the text last typed, so a number is not retyped.
    if (error === null) setDraft(value);
    setError(null);
    closing.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
    // Reopening is the only trigger; `value` changing under an open cell must not
    // discard what the user is typing.
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Every close path (Enter, Escape, blur, Tab past the grid edge) unmounts the input
    // and drops focus to document.body. Reclaim it for the resting button, but only when
    // nothing else already took it: a Tab that opened a neighbouring cell will have
    // focused that cell's input by the time this runs, and must keep it.
    if (wasEditing.current && !editing && document.activeElement === document.body) {
      buttonRef.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  function commit(direction?: 1 | -1) {
    if (closing.current) return;
    closing.current = true;
    const raw = draft;
    onClose(direction);
    if (raw === value) return;

    setPending(raw);
    onSave(raw)
      .then(() => setPending(null))
      .catch((reason: unknown) => {
        setPending(null);
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }

  function cancel() {
    if (closing.current) return;
    closing.current = true;
    onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Tab") {
      event.preventDefault();
      commit(event.shiftKey ? -1 : 1);
    }
  }

  if (editing) {
    return (
      <span className={styles.box}>
        {/* A column is only as wide as what sits in its cells, so the resting text stays
            in flow and holds the width while the input is laid over it. Hidden from
            assistive tech, which reads the input instead. */}
        <span className={styles.ghost} aria-hidden="true">
          {pending ?? display}
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          // An input's intrinsic width is 20 characters by default, and in an
          // auto-layout table that intrinsic width — not the declared percentage — is
          // what a column sizes to. One character keeps it out of the calculation, which
          // the text above owns.
          size={1}
          aria-label={label}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit()}
        />
      </span>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.cell}
      data-state={error != null ? "error" : pending != null ? "saving" : undefined}
      title={error ?? undefined}
      onClick={onOpen}
    >
      {pending ?? display}
    </button>
  );
}
