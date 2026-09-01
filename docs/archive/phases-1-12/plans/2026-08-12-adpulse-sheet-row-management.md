# AdPulse Sheet Row Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a media buyer move a day to another date through a calendar and delete a day from the sheet.

**Architecture:** A hand-written `DatePicker` joins the shared library as a month-grid popover that reports a selection and nothing else — dismissal on an outside click belongs to the cell that anchors it, because that cell is what wraps both the trigger and the popover. `DataTable` gains one domain-free slot, `rowAction`, so the feature decides that a row action is a trash button. Deletion is confirmed through the same `Dialog` that already backs client and sheet deletion.

**Tech Stack:** React 19, TypeScript, @tanstack/react-query v5, CSS Modules + design tokens, Vitest + jsdom + Testing Library + MSW. No backend changes.

**Spec:** [2026-08-12-adpulse-sheet-editing-design.md](../specs/2026-08-12-adpulse-sheet-editing-design.md). Cell editing is the companion plan,
[2026-08-12-adpulse-cell-editing.md](2026-08-12-adpulse-cell-editing.md), and must be
merged first: this plan edits `CampaignSheet.tsx` in the shape that plan leaves it in.

## Global Constraints

Shared conventions (English-only, Conventional Commits, TDD, testing setup, error
envelope) live in [conventions.md](../conventions.md). Phase-specific:

- **No backend changes.** `PATCH /api/records/:id` and `DELETE /api/records/:id` exist and are covered in `apps/api/test/records/record.api.test.ts`, the `409` on an occupied date included. Do not touch `apps/api`.
- **No date library, no component kit, no icon library** — the calendar and the trash icon are hand-written; the icon is inline SVG.
- **`components/` may not import from `features/`** and may not name a domain concept. `DatePicker` and `TrashIcon` must not mention campaigns, sheets, days or records. They may import `src/lib/`, which is shared infrastructure.
- **`components/` carries no UI copy** — every string a component shows comes in as a prop, the way `EmptyState` and `Tabs` already take theirs. Copy lives in `src/i18n/en.ts` and `t()` takes no parameters.
- **Dates are pure dates.** All arithmetic is UTC, and a day crosses the API as bare `YYYY-MM-DD`. Never build a day from a local-time `Date`.
- **Design tokens only** — colours, spacing and radii come from `var(--…)`. Structural values (border widths, `font-size`, grid tracks) may be literals.
- **Reordering and column management stay unbuilt** — no drag affordances, no property editor, not even disabled.
- **Commits are the user's to run.** Each task ends with the exact command; hand it over, do not execute it.

---

## File Structure

```
apps/web/src/
  lib/format.ts                                   + shiftDays; nextDay delegates     (Task 1)
  components/DatePicker/month.ts                  grid, labels, month stepping       (Task 1)
  components/DatePicker/DatePicker.tsx            popover, arrows, Escape            (Task 2)
  components/DatePicker/DatePicker.module.css                                        (Task 2)
  components/TrashIcon/TrashIcon.tsx              inline SVG                         (Task 5)
  components/DataTable/DataTable.tsx              + rowAction slot                   (Task 5)
  components/DataTable/DataTable.module.css       + trailing action column           (Task 5)
  features/campaigns/data/api.ts                  + recordsApi.update / remove       (Tasks 3, 6)
  features/campaigns/data/queries.ts              + useUpdateRecord / useDeleteRecord (Tasks 3, 6)
  features/campaigns/components/CampaignSheet/
    SheetDateCell.tsx + .module.css               trigger, popover, 409 message      (Task 4)
    CampaignSheet.tsx                             date cell, trash, confirmation     (Tasks 4, 6)
  i18n/en.ts                                      picker and deletion copy           (Tasks 4, 6)
```

**Why dismissal lives in `SheetDateCell` and not in `DatePicker`:** the element that must
swallow an outside click is the one wrapping *both* the trigger and the popover. The
popover cannot see the trigger, so a listener inside it would treat a click on the
trigger as "outside" and close what that click is about to reopen.

---

## Preflight

- [ ] Confirm the companion plan is merged: `git log --oneline | grep "edit sheet cell values"` returns a commit.
- [ ] Start the database: `docker compose up -d db`
- [ ] Run the API suite: `npm test`
- [ ] Expected: all suites pass, `test/records/record.api.test.ts` included.

---

### Task 1: Calendar arithmetic

**Files:**
- Modify: `apps/web/src/lib/format.ts:35-40`
- Test: `apps/web/src/lib/format.test.ts`
- Create: `apps/web/src/components/DatePicker/month.ts`
- Test: `apps/web/src/components/DatePicker/month.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `shiftDays(iso: string, days: number): string` from `src/lib/format.ts`; and from `month.ts` — `interface MonthCursor { year: number; month: number }`, `monthDays(cursor: MonthCursor): string[]` (42 ISO days), `monthLabel(cursor: MonthCursor): string`, `dayLabel(iso: string): string`, `monthOf(iso: string): MonthCursor`, `stepMonth(cursor: MonthCursor, delta: number): MonthCursor`, and `WEEKDAY_INITIALS: string[]`. Task 2 uses all of them.

- [ ] **Step 1: Write the failing tests**

Append to `lib/format.test.ts`:

```ts
describe("shiftDays", () => {
  it("moves a day forwards and backwards", () => {
    expect(shiftDays("2026-08-12", 1)).toBe("2026-08-13");
    expect(shiftDays("2026-08-12", -1)).toBe("2026-08-11");
    expect(shiftDays("2026-08-12", 7)).toBe("2026-08-19");
  });

  it("crosses month and year boundaries", () => {
    expect(shiftDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});
```

Add `shiftDays` to that file's import from `./format.js`.

Create `components/DatePicker/month.test.ts`:

```ts
import {
  WEEKDAY_INITIALS,
  dayLabel,
  monthDays,
  monthLabel,
  monthOf,
  stepMonth,
} from "./month.js";

describe("monthDays", () => {
  it("returns six full weeks, starting on the Monday on or before the first", () => {
    // 1 August 2026 is a Saturday, so the grid opens on Monday 27 July.
    const days = monthDays({ year: 2026, month: 7 });

    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-07-27");
    expect(days[5]).toBe("2026-08-01");
    expect(days.at(-1)).toBe("2026-09-06");
  });

  it("opens on the first itself when the month starts on a Monday", () => {
    // 1 June 2026 is a Monday.
    expect(monthDays({ year: 2026, month: 5 })[0]).toBe("2026-06-01");
  });
});

describe("monthLabel", () => {
  it("names the month and the year", () => {
    expect(monthLabel({ year: 2026, month: 7 })).toBe("August 2026");
  });
});

describe("dayLabel", () => {
  it("names a day unambiguously across a grid", () => {
    expect(dayLabel("2026-08-03")).toBe("03 August 2026");
  });
});

describe("monthOf", () => {
  it("reads the month a day belongs to", () => {
    expect(monthOf("2026-08-03")).toEqual({ year: 2026, month: 7 });
  });
});

describe("stepMonth", () => {
  it("steps within a year", () => {
    expect(stepMonth({ year: 2026, month: 7 }, 1)).toEqual({ year: 2026, month: 8 });
  });

  it("crosses the year boundary in both directions", () => {
    expect(stepMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(stepMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("WEEKDAY_INITIALS", () => {
  it("lists seven columns starting on Monday", () => {
    expect(WEEKDAY_INITIALS).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm run test:web -- src/lib/format.test.ts src/components/DatePicker/month.test.ts`
Expected: FAIL — `shiftDays` is not exported, and `./month.js` does not resolve.

- [ ] **Step 3: Add `shiftDays` and let `nextDay` delegate**

In `lib/format.ts`, replace the `nextDay` block with:

```ts
/** `iso` moved by whole days. UTC arithmetic, so no daylight-saving shift moves the day. */
export function shiftDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2026-08-31" -> "2026-09-01". */
export function nextDay(iso: string): string {
  return shiftDays(iso, 1);
}
```

- [ ] **Step 4: Write the month helpers**

Create `components/DatePicker/month.ts`:

```ts
export interface MonthCursor {
  year: number;
  /** Zero-based, matching `Date`. */
  month: number;
}

/** Column headings. Locale abbreviations, not app copy — the week starts on Monday. */
export const WEEKDAY_INITIALS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * The 42 days a month grid shows: six weeks from the Monday on or before the first, so
 * the grid keeps one height all year. UTC throughout — a day is a pure date and must
 * not shift with the viewer's zone.
 */
export function monthDays({ year, month }: MonthCursor): string[] {
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) =>
    new Date(Date.UTC(year, month, 1 - mondayOffset + index)).toISOString().slice(0, 10),
  );
}

/** "August 2026" — the grid's heading. */
export function monthLabel({ year, month }: MonthCursor): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "03 August 2026" — a day's accessible name, unique across a grid that shows three months. */
export function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthOf(iso: string): MonthCursor {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 };
}

export function stepMonth({ year, month }: MonthCursor, delta: number): MonthCursor {
  const stepped = new Date(Date.UTC(year, month + delta, 1));
  return { year: stepped.getUTCFullYear(), month: stepped.getUTCMonth() };
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npm run test:web -- src/lib/format.test.ts src/components/DatePicker/month.test.ts`
Expected: PASS, including every `format` case that was already green.

- [ ] **Step 6: Commit** (the user runs it)

```bash
git add apps/web/src/lib/format.ts apps/web/src/lib/format.test.ts \
        apps/web/src/components/DatePicker/month.ts \
        apps/web/src/components/DatePicker/month.test.ts
git commit -m "feat(web): add calendar month arithmetic"
```

---

### Task 2: The date picker

**Files:**
- Create: `apps/web/src/components/DatePicker/DatePicker.tsx`
- Create: `apps/web/src/components/DatePicker/DatePicker.module.css`
- Test: `apps/web/src/components/DatePicker/DatePicker.test.tsx`

**Interfaces:**
- Consumes: everything from `./month.js` (Task 1) and `shiftDays` from `src/lib/format.js`.
- Produces: `DatePicker` with props `{ value: string; labels: DatePickerLabels; onSelect: (iso: string) => void; onClose: () => void }` and `interface DatePickerLabels { dialog: string; previousMonth: string; nextMonth: string }`. Task 4 renders it.

The popover reports a selection and closes on `Escape`. It does **not** watch for outside
clicks — Task 4's anchor does, for the reason stated in the File Structure section.

- [ ] **Step 1: Write the failing test**

Create `DatePicker.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./DatePicker.js";

const labels = { dialog: "Choose a date", previousMonth: "Previous month", nextMonth: "Next month" };

function setup(overrides: { onSelect?: (iso: string) => void; onClose?: () => void } = {}) {
  return render(
    <DatePicker
      value="2026-08-03"
      labels={labels}
      onSelect={overrides.onSelect ?? (() => {})}
      onClose={overrides.onClose ?? (() => {})}
    />,
  );
}

describe("DatePicker", () => {
  it("opens on the month of its value", () => {
    setup();

    expect(screen.getByRole("dialog", { name: "Choose a date" })).toBeInTheDocument();
    expect(screen.getByText("August 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "03 August 2026" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the neighbouring days that fill the first and last week", () => {
    setup();

    // 1 August 2026 is a Saturday, so the grid opens on Monday 27 July.
    expect(screen.getByRole("button", { name: "27 July 2026" })).toHaveAttribute("data-outside", "true");
    expect(screen.getByRole("button", { name: "01 August 2026" })).not.toHaveAttribute("data-outside");
  });

  it("steps to the previous and the next month", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("September 2026")).toBeInTheDocument();
  });

  it("reports the day that was clicked", async () => {
    const onSelect = vi.fn();
    setup({ onSelect });

    await userEvent.click(screen.getByRole("button", { name: "12 August 2026" }));

    expect(onSelect).toHaveBeenCalledWith("2026-08-12");
  });

  it("focuses the selected day and moves focus with the arrow keys", async () => {
    setup();

    expect(screen.getByRole("button", { name: "03 August 2026" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "04 August 2026" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "11 August 2026" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "03 August 2026" })).toHaveFocus();
  });

  it("follows the arrow keys into the next month", async () => {
    render(
      <DatePicker value="2026-08-31" labels={labels} onSelect={() => {}} onClose={() => {}} />,
    );

    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "01 September 2026" })).toHaveFocus();
  });

  it("selects the focused day with Enter", async () => {
    const onSelect = vi.fn();
    setup({ onSelect });

    await userEvent.keyboard("{ArrowRight}{Enter}");

    expect(onSelect).toHaveBeenCalledWith("2026-08-04");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    setup({ onClose });

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- src/components/DatePicker/DatePicker.test.tsx`
Expected: FAIL — `Failed to resolve import "./DatePicker.js"`.

- [ ] **Step 3: Write the component**

Create `DatePicker.tsx`:

```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
  labels: DatePickerLabels;
  onSelect: (iso: string) => void;
  /** Escape only. Dismissing on an outside click belongs to whoever anchors the popover. */
  onClose: () => void;
}

const ARROW_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export function DatePicker({ value, labels, onSelect, onClose }: DatePickerProps) {
  const [cursor, setCursor] = useState(() => monthOf(value));
  const [focused, setFocused] = useState(value);
  const focusedRef = useRef<HTMLButtonElement>(null);

  // Roving tabindex: exactly one day is reachable, and focus follows the arrow keys.
  useEffect(() => {
    focusedRef.current?.focus();
  }, [focused]);

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

  return (
    <div className={styles.popover} role="dialog" aria-label={labels.dialog} onKeyDown={onKeyDown}>
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
    </div>
  );
}
```

Enter and Space need no handler: they activate the focused day button natively.

- [ ] **Step 4: Write the stylesheet**

Create `DatePicker.module.css`:

```css
.popover {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  margin-top: var(--space-1);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  white-space: nowrap;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.month {
  font-size: 13px;
  color: var(--color-text);
}

.step {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0 var(--space-2);
  font-size: 16px;
  line-height: 1;
}

.step:hover,
.step:focus-visible {
  color: var(--color-text);
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 32px);
  gap: 2px;
}

.weekday {
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  padding-bottom: var(--space-1);
}

.day {
  height: 30px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.day:hover,
.day:focus-visible {
  border-color: var(--color-border);
  outline: none;
}

.day[data-outside="true"] {
  color: var(--color-text-muted);
}

.day[aria-pressed="true"] {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm run test:web -- src/components/DatePicker/DatePicker.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit** (the user runs it)

```bash
git add apps/web/src/components/DatePicker/
git commit -m "feat(web): add a date picker popover"
```

---

### Task 3: Moving a day to another date

**Files:**
- Modify: `apps/web/src/features/campaigns/data/api.ts`
- Modify: `apps/web/src/features/campaigns/data/queries.ts`
- Test: `apps/web/src/features/campaigns/data/queries.test.tsx`

**Interfaces:**
- Consumes: `RecordInput` (`{ date: string }`) and `CampaignRecordSummary` (`{ id, campaignId, date }`), both already in `api.ts`.
- Produces: `recordsApi.update(recordId, body: RecordInput)`; `useUpdateRecord(campaignId)` whose mutation input is `{ id: string; body: RecordInput }`. Task 4 calls the hook.

A new date reorders the rows and the answer carries only the record, so this one
invalidates the table instead of patching it.

- [ ] **Step 1: Write the failing test**

Append to `queries.test.tsx`, adding `useUpdateRecord` to the import from `./queries.js`:

```tsx
describe("useUpdateRecord", () => {
  it("patches the date and refetches the table, because the rows reorder", async () => {
    let method = "";
    let received: unknown;
    let gets = 0;
    const table = {
      id: "c1",
      clientId: "1",
      name: "Search ads",
      position: 0,
      properties: [
        { id: "p1", key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
      ],
      records: [{ id: "r1", date: "2026-08-01", values: { p1: "120.0000" } }],
      totals: { p1: "120.0000" },
    };
    server.use(
      mock.get("/api/campaigns/c1", () => {
        gets += 1;
        return HttpResponse.json(table);
      }),
      mock.patch("/api/records/r1", async ({ request }) => {
        method = request.method;
        received = await request.json();
        return HttpResponse.json({ id: "r1", campaignId: "c1", date: "2026-08-05" });
      }),
    );

    const wrapper = hookWrapper();
    const { result } = renderHook(
      () => ({ table: useCampaignTable("c1"), update: useUpdateRecord("c1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.table.isSuccess).toBe(true));

    await result.current.update.mutateAsync({ id: "r1", body: { date: "2026-08-05" } });

    expect(method).toBe("PATCH");
    expect(received).toEqual({ date: "2026-08-05" });
    await waitFor(() => expect(gets).toBe(2));
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- src/features/campaigns/data/queries.test.tsx`
Expected: FAIL — `"useUpdateRecord" is not exported by "./queries.ts"`.

- [ ] **Step 3: Add the endpoint wrapper**

In `api.ts`, extend `recordsApi`:

```ts
export const recordsApi = {
  create: (campaignId: string, body: RecordInput) =>
    http.post<CampaignRecordSummary>(`/campaigns/${campaignId}/records`, body),
  update: (recordId: string, body: RecordInput) =>
    http.patch<CampaignRecordSummary>(`/records/${recordId}`, body),
};
```

- [ ] **Step 4: Add the hook**

Append to `queries.ts`:

```ts
/**
 * A new date reorders the rows and the answer carries only the record, so the table is
 * refetched rather than patched — one extra GET on a rare operation is the cheaper trade.
 */
export function useUpdateRecord(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RecordInput }) => recordsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", campaignId] }),
  });
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm run test:web -- src/features/campaigns/data/queries.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit** (the user runs it)

```bash
git add apps/web/src/features/campaigns/data/api.ts \
        apps/web/src/features/campaigns/data/queries.ts \
        apps/web/src/features/campaigns/data/queries.test.tsx
git commit -m "feat(web): move a day to another date"
```

---

### Task 4: The date cell

**Files:**
- Create: `apps/web/src/features/campaigns/components/CampaignSheet/SheetDateCell.tsx`
- Create: `apps/web/src/features/campaigns/components/CampaignSheet/SheetDateCell.module.css`
- Modify: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`

**Interfaces:**
- Consumes: `DatePicker`, `DatePickerLabels` (Task 2); `useUpdateRecord` (Task 3); `ApiError` from `src/lib/http.js`.
- Produces: `SheetDateCell` with props `{ campaignId: string; recordId: string; date: string }`. Task 6 leaves it untouched.

- [ ] **Step 1: Write the failing test**

Append to `CampaignSheet.test.tsx`:

```tsx
  it("opens a date picker on the day cell and moves the day", async () => {
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.patch("/api/records/r1", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: "r1", campaignId: "c1", date: "2026-08-05" });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "01 Aug" }));
    await userEvent.click(screen.getByRole("button", { name: "05 August 2026" }));

    await waitFor(() => expect(received).toEqual({ date: "2026-08-05" }));
  });

  it("closes the picker on a click outside it", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "01 Aug" }));
    expect(screen.getByRole("dialog", { name: "Choose a date" })).toBeInTheDocument();

    await userEvent.click(document.body);

    expect(screen.queryByRole("dialog", { name: "Choose a date" })).not.toBeInTheDocument();
  });

  it("sends nothing when the same day is picked again", async () => {
    let patches = 0;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.patch("/api/records/r1", () => {
        patches += 1;
        return HttpResponse.json({ id: "r1", campaignId: "c1", date: "2026-08-01" });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "01 Aug" }));
    await userEvent.click(screen.getByRole("button", { name: "01 August 2026" }));

    expect(screen.queryByRole("dialog", { name: "Choose a date" })).not.toBeInTheDocument();
    expect(patches).toBe(0);
  });

  it("shows the server's message when the date is taken", async () => {
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.patch("/api/records/r1", () =>
        HttpResponse.json(
          { error: { message: "The campaign already has a record for 2026-08-02" } },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "01 Aug" }));
    await userEvent.click(screen.getByRole("button", { name: "02 August 2026" }));

    const trigger = await screen.findByRole("button", { name: "01 Aug" });
    await waitFor(() =>
      expect(trigger).toHaveAttribute("title", "The campaign already has a record for 2026-08-02"),
    );
    expect(trigger).toHaveAttribute("data-state", "error");
  });
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`
Expected: FAIL — the day cell renders text, so there is no `01 Aug` button to click.

- [ ] **Step 3: Add the copy**

In `i18n/en.ts`, after the `"sheet.value.invalid"` line:

```ts
  "sheet.date.choose": "Choose a date",
  "sheet.date.previousMonth": "Previous month",
  "sheet.date.nextMonth": "Next month",
  "sheet.date.failed": "The day could not be moved",
```

- [ ] **Step 4: Write the date cell**

Create `SheetDateCell.tsx`. It owns dismissal because its anchor wraps both the trigger
and the popover:

```tsx
import { useEffect, useRef, useState } from "react";
import { DatePicker } from "../../../../components/DatePicker/DatePicker.js";
import { formatDay } from "../../../../lib/format.js";
import { ApiError } from "../../../../lib/http.js";
import { t } from "../../../../i18n/en.js";
import { useUpdateRecord } from "../../data/queries.js";
import styles from "./SheetDateCell.module.css";

export interface SheetDateCellProps {
  campaignId: string;
  recordId: string;
  date: string;
}

export function SheetDateCell({ campaignId, recordId, date }: SheetDateCellProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const update = useUpdateRecord(campaignId);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function select(iso: string) {
    setOpen(false);
    if (iso === date) return;
    setError(null);
    try {
      await update.mutateAsync({ id: recordId, body: { date: iso } });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t("sheet.date.failed"));
    }
  }

  return (
    <span ref={anchor} className={styles.anchor}>
      <button
        type="button"
        className={styles.trigger}
        data-state={error != null ? "error" : undefined}
        title={error ?? undefined}
        onClick={() => {
          setError(null);
          setOpen((wasOpen) => !wasOpen);
        }}
      >
        {formatDay(date)}
      </button>
      {open && (
        <DatePicker
          value={date}
          labels={{
            dialog: t("sheet.date.choose"),
            previousMonth: t("sheet.date.previousMonth"),
            nextMonth: t("sheet.date.nextMonth"),
          }}
          onSelect={select}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}
```

- [ ] **Step 5: Write the stylesheet**

Create `SheetDateCell.module.css`:

```css
.anchor {
  position: relative;
  display: inline-block;
}

.trigger {
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 0 var(--space-1);
  cursor: pointer;
}

.trigger:hover,
.trigger:focus-visible {
  border-color: var(--color-border);
  outline: none;
}

.trigger[data-state="error"] {
  border-color: var(--color-danger);
}
```

- [ ] **Step 6: Render it in the sheet**

In `CampaignSheet.tsx`, add the import:

```tsx
import { SheetDateCell } from "./SheetDateCell.js";
```

and replace the date cell inside the `rows` mapping:

```tsx
      [DATE_COLUMN]: (
        <SheetDateCell campaignId={campaignId} recordId={record.id} date={record.date} />
      ),
```

The footer keeps `formatDay`-free plain copy (`t("sheet.total")`) and is untouched.

- [ ] **Step 7: Run the whole web suite and watch it pass**

Run: `npm run test:web`
Expected: PASS — the four new cases plus every existing one. The `rowheader` assertions in
the older tests still match, because the button's text is the accessible name of the cell.

- [ ] **Step 8: Commit** (the user runs it)

```bash
git add apps/web/src/features/campaigns/components/CampaignSheet/SheetDateCell.tsx \
        apps/web/src/features/campaigns/components/CampaignSheet/SheetDateCell.module.css \
        apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx \
        apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx \
        apps/web/src/i18n/en.ts
git commit -m "feat(web): pick a day's date from a calendar"
```

---

### Task 5: A trailing action column

**Files:**
- Create: `apps/web/src/components/TrashIcon/TrashIcon.tsx`
- Test: `apps/web/src/components/TrashIcon/TrashIcon.test.tsx`
- Modify: `apps/web/src/components/DataTable/DataTable.tsx`
- Modify: `apps/web/src/components/DataTable/DataTable.module.css`
- Test: `apps/web/src/components/DataTable/DataTable.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `TrashIcon` (no props, decorative); `DataTableProps.rowAction?: (row: DataRow) => ReactNode`. Task 6 uses both.

- [ ] **Step 1: Write the failing tests**

Create `TrashIcon.test.tsx`, mirroring `PencilIcon.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { TrashIcon } from "./TrashIcon.js";

describe("TrashIcon", () => {
  it("renders a decorative svg that inherits the text colour", () => {
    const { container } = render(<TrashIcon />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
  });
});
```

Append to `DataTable.test.tsx`:

```tsx
  it("renders a row action in a trailing cell of every body row", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowAction={(row) => <button type="button">Delete {row.id}</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete r1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete r2" })).toBeInTheDocument();
  });

  it("leaves the footer's action cell empty", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        footer={{ id: "totals", cells: { date: "TOTAL", spend: "255.50" } }}
        rowAction={(row) => <button type="button">Delete {row.id}</button>}
      />,
    );

    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    expect(within(footer).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete totals" })).not.toBeInTheDocument();
  });

  it("adds no trailing column when no row action is given", () => {
    render(<DataTable columns={columns} rows={rows} />);

    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm run test:web -- src/components/TrashIcon/TrashIcon.test.tsx src/components/DataTable/DataTable.test.tsx`
Expected: FAIL — `./TrashIcon.js` does not resolve, and `rowAction` is not a prop of `DataTable`.

- [ ] **Step 3: Write the icon**

Create `TrashIcon.tsx`:

```tsx
/** Decorative — the button that wraps it carries the accessible name. */
export function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
```

- [ ] **Step 4: Add the slot to `DataTable`**

In `DataTable.tsx`, extend the props and the three row sites. The slot takes a row rather
than a flag, so the table learns nothing about what the action does:

```tsx
export interface DataTableProps {
  columns: DataColumn[];
  rows: DataRow[];
  footer?: DataRow;
  /** Rendered in a trailing column, once per body row. Never called for the footer. */
  rowAction?: (row: DataRow) => ReactNode;
}
```

In the `thead` row, after the column headers:

```tsx
            {rowAction != null && <th scope="col" className={styles.action} />}
```

In each body row, after `<Cells columns={columns} row={row} />`:

```tsx
              {rowAction != null && <td className={styles.action}>{rowAction(row)}</td>}
```

In the footer row, after its `<Cells …/>`:

```tsx
              {rowAction != null && <td className={styles.action} />}
```

- [ ] **Step 5: Style the column**

Append to `DataTable.module.css`:

```css
/* Shrinks to the control it holds, so the data columns keep the remaining width. */
.table .action {
  width: 1%;
  padding-left: var(--space-2);
  padding-right: var(--space-2);
  text-align: right;
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm run test:web -- src/components/TrashIcon/TrashIcon.test.tsx src/components/DataTable/DataTable.test.tsx`
Expected: PASS, including the four `DataTable` cases that were already green.

- [ ] **Step 7: Commit** (the user runs it)

```bash
git add apps/web/src/components/TrashIcon/ apps/web/src/components/DataTable/
git commit -m "feat(web): add a trailing row-action column to the data table"
```

---

### Task 6: Deleting a day

**Files:**
- Modify: `apps/web/src/features/campaigns/data/api.ts`
- Modify: `apps/web/src/features/campaigns/data/queries.ts`
- Test: `apps/web/src/features/campaigns/data/queries.test.tsx`
- Modify: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx`
- Modify: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.module.css`
- Modify: `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`

**Interfaces:**
- Consumes: `TrashIcon` and `DataTableProps.rowAction` (Task 5); `Dialog` and `Button` from the shared library.
- Produces: `recordsApi.remove(recordId)`; `useDeleteRecord(campaignId)` taking a record id. Nothing later depends on them.

- [ ] **Step 1: Write the failing tests**

Append to `queries.test.tsx`, adding `useDeleteRecord` to the import from `./queries.js`:

```tsx
describe("useDeleteRecord", () => {
  it("sends DELETE for one day", async () => {
    let method = "";
    server.use(
      mock.delete("/api/records/r1", ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDeleteRecord("c1"), { wrapper: hookWrapper() });
    await result.current.mutateAsync("r1");

    expect(method).toBe("DELETE");
  });
});
```

Append to `CampaignSheet.test.tsx`:

```tsx
  it("asks before deleting a day and then deletes it", async () => {
    let method = "";
    let gets = 0;
    server.use(
      mock.get("/api/campaigns/c1", () => {
        gets += 1;
        return HttpResponse.json(gets === 1 ? table : { ...table, records: [table.records[1]] });
      }),
      mock.delete("/api/records/r1", ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete day, 01 Aug" }));
    expect(screen.getByText("Delete day?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(method).toBe("DELETE");
    await waitFor(() =>
      expect(screen.queryByRole("rowheader", { name: "01 Aug" })).not.toBeInTheDocument(),
    );
  });

  it("keeps the day when the confirmation is cancelled", async () => {
    let deletes = 0;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.delete("/api/records/r1", () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete day, 01 Aug" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deletes).toBe(0);
    expect(screen.getByRole("rowheader", { name: "01 Aug" })).toBeInTheDocument();
  });

  it("renders no delete control on the totals row", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await screen.findByRole("columnheader", { name: "SPEND" });
    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    expect(within(footer).queryByRole("button")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm run test:web -- src/features/campaigns/data/queries.test.tsx src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`
Expected: FAIL — `useDeleteRecord` is not exported, and no `Delete day, 01 Aug` button exists.

- [ ] **Step 3: Add the endpoint wrapper and the hook**

In `api.ts`, extend `recordsApi` with:

```ts
  remove: (recordId: string) => http.del(`/records/${recordId}`),
```

Append to `queries.ts`:

```ts
export function useDeleteRecord(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => recordsApi.remove(recordId),
    // The rows and the totals both change when a day goes.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", campaignId] }),
  });
}
```

- [ ] **Step 4: Add the copy**

In `i18n/en.ts`, after the `"sheet.date.failed"` line:

```ts
  "sheet.delete": "Delete day",
  "sheet.delete.title": "Delete day?",
  "sheet.delete.body": "This permanently deletes the day and all of its values.",
```

- [ ] **Step 5: Wire the trash button and the confirmation into `CampaignSheet.tsx`**

Add the imports:

```tsx
import { useState } from "react";
import { Dialog } from "../../../../components/Dialog/Dialog.js";
import { TrashIcon } from "../../../../components/TrashIcon/TrashIcon.js";
import { useCampaignTable, useCreateRecord, useDeleteRecord, useSetValue } from "../../data/queries.js";
```

Beside the other hooks, before the early returns:

```tsx
  const removeDay = useDeleteRecord(campaignId);
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);
```

After the `footer` is built, resolve which day is being deleted so the dialog can render
outside the table:

```tsx
  const deletingDate = records.find((record) => record.id === deletingId)?.date;
```

Pass the slot to the table and render the dialog as its sibling:

```tsx
      <DataTable
        columns={columns}
        rows={rows}
        footer={footer}
        rowAction={(row) => (
          <button
            type="button"
            className={styles.rowAction}
            aria-label={`${t("sheet.delete")}, ${formatDay(
              records.find((record) => record.id === row.id)!.date,
            )}`}
            onClick={() => setDeletingId(row.id)}
          >
            <TrashIcon />
          </button>
        )}
      />

      {deletingDate != null && (
        <Dialog open onClose={() => setDeletingId(undefined)} title={t("sheet.delete.title")}>
          <p>{t("sheet.delete.body")}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setDeletingId(undefined)}>
              {t("action.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={removeDay.isPending}
              onClick={async () => {
                await removeDay.mutateAsync(deletingId!);
                setDeletingId(undefined);
              }}
            >
              {t("action.delete")}
            </Button>
          </div>
        </Dialog>
      )}
```

- [ ] **Step 6: Style the control**

Append to `CampaignSheet.module.css`. It stays legible without hovering, which a touch
device cannot do, and gains contrast on hover and focus:

```css
.rowAction {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  padding: var(--space-1);
  color: var(--color-text-muted);
  cursor: pointer;
}

.rowAction:hover,
.rowAction:focus-visible {
  color: var(--color-danger);
  outline: none;
}
```

- [ ] **Step 7: Run the whole web suite and watch it pass**

Run: `npm run test:web`
Expected: PASS — every suite, old and new.

- [ ] **Step 8: Typecheck**

Run: `npm run build:web`
Expected: `tsc` reports no errors and Vite builds.

- [ ] **Step 9: Commit** (the user runs it)

```bash
git add apps/web/src/features/campaigns/data/api.ts \
        apps/web/src/features/campaigns/data/queries.ts \
        apps/web/src/features/campaigns/data/queries.test.tsx \
        apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx \
        apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.module.css \
        apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx \
        apps/web/src/i18n/en.ts
git commit -m "feat(web): delete a day from a sheet"
```

---

## Done when

- Clicking a day opens a calendar on that day's month; arrows step months, arrow keys move by day, Enter and a click both select, Escape and an outside click dismiss.
- Picking a different day moves it and refetches the table; picking the same day sends nothing.
- A taken date shows the server's `409` message on the day cell.
- Every day row carries a trash button, the totals row carries none, and deleting is confirmed through a dialog.
- `npm run test:web` and `npm run build:web` are green.
