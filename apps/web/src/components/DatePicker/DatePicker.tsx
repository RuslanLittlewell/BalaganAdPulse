import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { shiftDays } from "../../lib/format.js";
import {
  WEEKDAY_INITIALS,
  dayLabel,
  monthDays,
  monthLabel,
  monthOf,
  stepMonth,
} from "./month.js";
import styles from "./DatePicker.module.css";

export interface DatePickerLabels {
  dialog: string;
  previousMonth: string;
  nextMonth: string;
}

export interface DatePickerProps {
  /** The selected day, "YYYY-MM-DD". */
  value: string;
  /**
   * The element the popover hangs under. Also the one region an outside click may not
   * dismiss on: it is what toggles the popover, so closing there would fight the reopen.
   */
  anchorTo: HTMLElement | null;
  labels: DatePickerLabels;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

const ARROW_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/** Breathing room between the anchor and the popover, and against the viewport edges. */
const GAP = 4;

/**
 * Viewport coordinates, because the popover is `fixed`. It renders through a portal and
 * is positioned by hand rather than laid out next to the trigger: an anchored popover
 * inside a scrolling table would be clipped by that scroll box, and a sticky cell always
 * creates a stacking context, so no `z-index` could lift it over sticky headers either.
 */
function place(anchor: HTMLElement, popover: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const { offsetHeight: height, offsetWidth: width } = popover;

  const below = rect.bottom + GAP;
  const above = rect.top - GAP - height;
  const flip = below + height > window.innerHeight && above >= 0;
  popover.style.top = `${flip ? above : below}px`;

  const rightmost = window.innerWidth - width - GAP;
  popover.style.left = `${Math.max(GAP, Math.min(rect.left, rightmost))}px`;
}

export function DatePicker({ value, anchorTo, labels, onSelect, onClose }: DatePickerProps) {
  const [cursor, setCursor] = useState(() => monthOf(value));
  const [focused, setFocused] = useState(value);
  const focusedRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Roving tabindex: exactly one day is reachable, and focus follows the arrow keys.
  useEffect(() => {
    focusedRef.current?.focus();
  }, [focused]);

  // Before paint, so the popover never shows up at the wrong place first. The sheet
  // scrolls underneath it, so the position is recomputed rather than set once.
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (popover == null || anchorTo == null) return;
    const reposition = () => place(anchorTo, popover);
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [anchorTo]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || anchorTo?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [anchorTo, onClose]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = ARROW_STEPS[event.key];
    if (step != null) {
      event.preventDefault();
      const next = shiftDays(focused, step);
      setFocused(next);
      setCursor(monthOf(next));
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return createPortal(
    <div
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      aria-label={labels.dialog}
      onKeyDown={onKeyDown}
    >
      <div className={styles.header}>
        <button
          type="button"
          className={styles.step}
          aria-label={labels.previousMonth}
          onClick={() => setCursor(stepMonth(cursor, -1))}
        >
          ‹
        </button>
        <span className={styles.month}>{monthLabel(cursor)}</span>
        <button
          type="button"
          className={styles.step}
          aria-label={labels.nextMonth}
          onClick={() => setCursor(stepMonth(cursor, 1))}
        >
          ›
        </button>
      </div>

      <div className={styles.grid}>
        {WEEKDAY_INITIALS.map((initial) => (
          <span key={initial} className={styles.weekday} aria-hidden="true">
            {initial}
          </span>
        ))}
        {monthDays(cursor).map((iso) => (
          <button
            key={iso}
            type="button"
            ref={iso === focused ? focusedRef : undefined}
            className={styles.day}
            aria-label={dayLabel(iso)}
            aria-pressed={iso === value}
            data-outside={monthOf(iso).month === cursor.month ? undefined : "true"}
            tabIndex={iso === focused ? 0 : -1}
            onClick={() => onSelect(iso)}
          >
            {Number(iso.slice(8, 10))}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
