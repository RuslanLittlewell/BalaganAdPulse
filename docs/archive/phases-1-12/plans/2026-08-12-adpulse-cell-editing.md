# AdPulse Cell Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a media buyer type numbers and comments straight into the daily statistics grid — a click opens the cell, Enter or Tab saves it, and the computed columns and the TOTAL row refresh from the server's answer.

**Architecture:** `DataTable` stays presentational; the feature puts an `EditableCell` into the cells of entered properties and a plain string into computed ones. `EditableCell` knows nothing about campaigns — it takes `display`, `value` and an `onSave` promise, and a rejection of that promise is what puts it in the error state. Domain judgement lives in two pure functions in `sheetValue.ts`, and the open-cell position lives in `useSheetEditing.ts`, so `CampaignSheet` stays a composition.

**Tech Stack:** React 19, TypeScript, @tanstack/react-query v5, CSS Modules + design tokens, Vitest + jsdom + Testing Library + MSW. No backend changes.

**Spec:** [2026-08-12-adpulse-sheet-editing-design.md](../specs/2026-08-12-adpulse-sheet-editing-design.md). This plan covers cell editing only; the date picker and row deletion are
[2026-08-12-adpulse-sheet-row-management.md](2026-08-12-adpulse-sheet-row-management.md).

## Global Constraints

Shared conventions (English-only, Conventional Commits, TDD, testing setup, error
envelope) live in [conventions.md](../conventions.md). Phase-specific:

- **No backend changes.** `PUT /api/records/:recordId/values/:propertyId` exists and is covered by twelve cases in `apps/api/test/records/value.api.test.ts`. Do not touch `apps/api`.
- **No utility-CSS framework, no component kit, no icon library** — hand-written `Component.tsx` + `Component.module.css`.
- **`components/` may not import from `features/`** and may not name a domain concept. `EditableCell` must not mention campaigns, sheets, properties or records.
- **Design tokens only** — colours, spacing and radii come from `var(--…)`. Structural values (border widths, `font-size`, `text-align`) may be literals.
- **UI copy** lives in `src/i18n/en.ts` and is read through `t(key)`, never inlined in JSX and never inside `components/` or `sheetValue.ts`. `t()` takes no parameters; do not add interpolation.
- **Numbers cross the API as four-decimal strings** and stay strings on the client. Never `parseFloat` a value and send the result back.
- **Row management stays unbuilt** — no date editing, no row deletion, no trash icon, not even disabled. That is the second plan.
- **Commits are the user's to run.** Each task ends with the exact command; hand it over, do not execute it.

---

## Preflight

Confirm the contract this plan builds on before writing any frontend code.

- [ ] Start the database: `docker compose up -d db`
- [ ] Run the API suite: `npm test`
- [ ] Expected: all suites pass, including `test/records/value.api.test.ts`. If anything fails, stop and report — this plan assumes a green backend.

---

## File Structure

```
apps/web/src/
  lib/http.ts                                     + put                              (Task 2)
  components/EditableCell/EditableCell.tsx        click -> input; Enter/Tab/Esc      (Task 3)
  components/EditableCell/EditableCell.module.css cell button and input metrics      (Task 3)
  components/EditableCell/EditableCell.test.tsx                                      (Task 3)
  features/campaigns/data/api.ts                  + valuesApi.set, ValueWriteResult  (Task 2)
  features/campaigns/data/queries.ts              + useSetValue                      (Task 2)
  features/campaigns/components/CampaignSheet/
    sheetValue.ts                                 toInputValue, normalizeInput       (Task 1)
    sheetValue.test.ts                                                               (Task 1)
    useSheetEditing.ts                            nextCell + open-cell state         (Task 4)
    useSheetEditing.test.ts                                                          (Task 4)
    CampaignSheet.tsx                             wires the three together           (Task 5)
  i18n/en.ts                                      + sheet.value.invalid              (Task 5)
```

**Why the helpers sit beside `CampaignSheet` and not in `lib/`:** they encode how *this*
grid turns a stored value into editable text and back. `lib/format.ts` is the display
direction and is used by other features; the input direction has exactly one consumer.

---

### Task 1: Raw value in, stored value out

**Files:**
- Create: `apps/web/src/features/campaigns/components/CampaignSheet/sheetValue.ts`
- Test: `apps/web/src/features/campaigns/components/CampaignSheet/sheetValue.test.ts`

**Interfaces:**
- Consumes: `PropertyType` from `src/lib/format.ts` — `"NUMBER" | "MONEY" | "PERCENT" | "TEXT"`.
- Produces: `toInputValue(value: string | null, type: PropertyType): string`, `normalizeInput(raw: string, type: PropertyType): string | null`, and `class InvalidValueError extends Error`. Task 5 calls both; Task 3 does not.

- [ ] **Step 1: Write the failing test**

Create `sheetValue.test.ts`:

```ts
import { InvalidValueError, normalizeInput, toInputValue } from "./sheetValue.js";

describe("toInputValue", () => {
  it("trims the trailing zeros the API pads values with", () => {
    expect(toInputValue("1250.0000", "MONEY")).toBe("1250");
    expect(toInputValue("2.6700", "PERCENT")).toBe("2.67");
    expect(toInputValue("10.0100", "NUMBER")).toBe("10.01");
    expect(toInputValue("0.0001", "NUMBER")).toBe("0.0001");
  });

  it("returns an empty string for an empty cell", () => {
    expect(toInputValue(null, "MONEY")).toBe("");
    expect(toInputValue(null, "TEXT")).toBe("");
  });

  it("leaves text untouched", () => {
    expect(toInputValue("good day", "TEXT")).toBe("good day");
    expect(toInputValue("1250.0000", "TEXT")).toBe("1250.0000");
  });
});

describe("normalizeInput", () => {
  it("maps an empty or blank input to null, which clears the cell", () => {
    expect(normalizeInput("", "MONEY")).toBeNull();
    expect(normalizeInput("   ", "TEXT")).toBeNull();
  });

  it("reads a comma as a decimal separator", () => {
    expect(normalizeInput("1250,5", "MONEY")).toBe("1250.5");
  });

  it("trims and passes through valid numbers, negatives included", () => {
    expect(normalizeInput(" 1250 ", "MONEY")).toBe("1250");
    expect(normalizeInput("-12.5", "NUMBER")).toBe("-12.5");
  });

  it("trims text without validating it", () => {
    expect(normalizeInput("  good day  ", "TEXT")).toBe("good day");
  });

  it("rejects input a numeric property cannot store", () => {
    expect(() => normalizeInput("abc", "MONEY")).toThrow(InvalidValueError);
    expect(() => normalizeInput("12.5.7", "NUMBER")).toThrow(InvalidValueError);
    expect(() => normalizeInput("1 250", "MONEY")).toThrow(InvalidValueError);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- src/features/campaigns/components/CampaignSheet/sheetValue.test.ts`
Expected: FAIL — `Failed to resolve import "./sheetValue.js"`.

- [ ] **Step 3: Write the implementation**

Create `sheetValue.ts`:

```ts
import type { PropertyType } from "../../../../lib/format.js";

/** Mirrors the server's rule in `value.service.ts`, so invalid input never travels. */
const DECIMAL = /^-?\d+(\.\d+)?$/;

/** Raised when numeric input cannot be stored. Carries no copy: UI text lives in `en.ts`. */
export class InvalidValueError extends Error {}

/**
 * The text an input starts with. Values arrive padded to four decimals to preserve
 * precision (`1250.0000`), but the number a person edits is `1250`.
 */
export function toInputValue(value: string | null, type: PropertyType): string {
  if (value === null) return "";
  if (type === "TEXT" || !DECIMAL.test(value) || !value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Raw input to what the API stores. An empty input clears the cell; a comma reads as
 * a decimal separator, the way a numpad offers it.
 */
export function normalizeInput(raw: string, type: PropertyType): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (type === "TEXT") return trimmed;

  const numeric = trimmed.replace(",", ".");
  if (!DECIMAL.test(numeric)) throw new InvalidValueError();
  return numeric;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- src/features/campaigns/components/CampaignSheet/sheetValue.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit** (the user runs it)

```bash
git add apps/web/src/features/campaigns/components/CampaignSheet/sheetValue.ts \
        apps/web/src/features/campaigns/components/CampaignSheet/sheetValue.test.ts
git commit -m "feat(web): convert sheet values between stored and editable form"
```

---

### Task 2: Writing a value and patching the cache

**Files:**
- Modify: `apps/web/src/lib/http.ts:40-47`
- Modify: `apps/web/src/features/campaigns/data/api.ts:64-67`
- Modify: `apps/web/src/features/campaigns/data/queries.ts:41-48`
- Test: `apps/web/src/features/campaigns/data/queries.test.tsx`

**Interfaces:**
- Consumes: `CampaignTable`, `CampaignRecord` from `./api.js`; the query key `["campaigns", campaignId]` that `useCampaignTable` already owns.
- Produces: `http.put<T>(path, body)`; `valuesApi.set(recordId, propertyId, value: string | null): Promise<ValueWriteResult>` where `ValueWriteResult = { record: CampaignRecord; totals: Record<string, string | null> }`; `useSetValue(campaignId)` whose mutation input is `{ recordId: string; propertyId: string; value: string | null }`. Task 5 calls `useSetValue`.

- [ ] **Step 1: Write the failing test**

Append to `queries.test.tsx`, and add `useSetValue` to the import list at the top of the file:

```tsx
describe("useSetValue", () => {
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

  it("puts the value and writes the answer into the table cache", async () => {
    let method = "";
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", async ({ request }) => {
        method = request.method;
        received = await request.json();
        return HttpResponse.json({
          record: { id: "r1", date: "2026-08-01", values: { p1: "200.0000" } },
          totals: { p1: "200.0000" },
        });
      }),
    );

    const wrapper = hookWrapper();
    const { result } = renderHook(
      () => ({ table: useCampaignTable("c1"), set: useSetValue("c1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.table.isSuccess).toBe(true));

    await result.current.set.mutateAsync({ recordId: "r1", propertyId: "p1", value: "200" });

    expect(method).toBe("PUT");
    expect(received).toEqual({ value: "200" });
    await waitFor(() => expect(result.current.table.data?.records[0].values.p1).toBe("200.0000"));
    expect(result.current.table.data?.totals.p1).toBe("200.0000");
  });

  it("ignores a stale answer that arrives after a newer one", async () => {
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", async ({ request }) => {
        const body = (await request.json()) as { value: string };
        // The first write answers last, so its response must not win.
        if (body.value === "200") await delay(50);
        return HttpResponse.json({
          record: { id: "r1", date: "2026-08-01", values: { p1: `${body.value}.0000` } },
          totals: { p1: `${body.value}.0000` },
        });
      }),
    );

    const wrapper = hookWrapper();
    const { result } = renderHook(
      () => ({ table: useCampaignTable("c1"), set: useSetValue("c1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.table.isSuccess).toBe(true));

    // Both writes settle inside one act block, so the state updates they cause do not
    // land outside React's act environment and warn.
    await act(async () => {
      const slow = result.current.set.mutateAsync({ recordId: "r1", propertyId: "p1", value: "200" });
      const fast = result.current.set.mutateAsync({ recordId: "r1", propertyId: "p1", value: "300" });
      await Promise.all([slow, fast]);
    });

    expect(result.current.table.data?.records[0].values.p1).toBe("300.0000");
    expect(result.current.table.data?.totals.p1).toBe("300.0000");
  });

  it("still patches a straggler's own row when a later write lands for a different record", async () => {
    const twoRowTable = {
      ...table,
      records: [
        { id: "r1", date: "2026-08-01", values: { p1: "120.0000" } },
        { id: "r2", date: "2026-08-02", values: { p1: "50.0000" } },
      ],
    };
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(twoRowTable)),
      mock.put("/api/records/:recordId/values/:propertyId", async ({ request, params }) => {
        const body = (await request.json()) as { value: string };
        const recordId = params.recordId as string;
        // r1 is issued first but answers last, so it carries the lower sequence number.
        if (recordId === "r1") await delay(50);
        return HttpResponse.json({
          record: {
            id: recordId,
            date: recordId === "r1" ? "2026-08-01" : "2026-08-02",
            values: { p1: `${body.value}.0000` },
          },
          totals: { p1: `${body.value}.0000` },
        });
      }),
    );

    const wrapper = hookWrapper();
    const { result } = renderHook(
      () => {
        const table = useCampaignTable("c1");
        // React Query only tracks properties a render actually reads; touching `data`
        // here (unlike the other tests in this file) makes it register the two
        // *different*-record cache writes below as separate, individually-tracked
        // updates instead of coalescing them into one.
        void table.data;
        return { table, set: useSetValue("c1") };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.table.isSuccess).toBe(true));

    await act(async () => {
      const first = result.current.set.mutateAsync({ recordId: "r1", propertyId: "p1", value: "200" });
      const second = result.current.set.mutateAsync({ recordId: "r2", propertyId: "p1", value: "300" });
      await Promise.all([first, second]);
    });

    // r1's answer is the straggler and lands after r2's already rendered; wait for that
    // second render rather than asserting on the snapshot act() leaves behind.
    await waitFor(() => expect(result.current.table.data?.records[0].values.p1).toBe("200.0000"));
    expect(result.current.table.data?.records[1].values.p1).toBe("300.0000");
    expect(result.current.table.data?.totals.p1).toBe("300.0000");
  });
});
```

Extend the two imports at the top of the file — `delay` for the staggered handler and
`act` for the block above:

```tsx
import { http as mock, HttpResponse, delay } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- src/features/campaigns/data/queries.test.tsx`
Expected: FAIL — `"useSetValue" is not exported by "./queries.ts"`.

- [ ] **Step 3: Add `put` to the HTTP client**

In `lib/http.ts`, inside the exported `http` object, between `post` and `patch`:

```ts
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
```

- [ ] **Step 4: Add the endpoint wrapper**

Append to `features/campaigns/data/api.ts`:

```ts
/** What the value endpoint answers with: the recomputed row and the recomputed totals. */
export interface ValueWriteResult {
  record: CampaignRecord;
  totals: Record<string, string | null>;
}

export const valuesApi = {
  set: (recordId: string, propertyId: string, value: string | null) =>
    http.put<ValueWriteResult>(`/records/${recordId}/values/${propertyId}`, { value }),
};
```

- [ ] **Step 5: Add the mutation hook**

In `features/campaigns/data/queries.ts`, extend the first two imports and append the hook:

```ts
import { useRef } from "react";
import {
  campaignsApi,
  recordsApi,
  valuesApi,
  type CampaignInput,
  type CampaignTable,
  type RecordInput,
} from "./api.js";

export interface SetValueInput {
  recordId: string;
  propertyId: string;
  value: string | null;
}

/**
 * The answer carries the recomputed row and totals, so one request repaints the entered
 * cell, every column derived from it and the footer — no refetch, no stale flash.
 *
 * Tabbing quickly can leave two writes in flight and their answers can arrive out of
 * order, so each mutation takes a number — but the two halves of an answer follow
 * different rules. `totals` is one shared value and the highest number wins it. A row is
 * not: tabbing across a row edge races writes against two *different* records, and an
 * older answer for one record is not superseded by a newer answer for the other. So the
 * row patch uses a per-record high-water mark — an answer lands on its own row unless a
 * later answer for that same row already applied. Dropping it instead would erase an
 * accepted write from the screen with no refetch to heal it.
 */
export function useSetValue(campaignId: string) {
  const qc = useQueryClient();
  const issued = useRef(0);
  const appliedTotals = useRef(0);
  const appliedRecords = useRef(new Map<string, number>());

  return useMutation({
    mutationFn: async (input: SetValueInput) => {
      const seq = ++issued.current;
      const result = await valuesApi.set(input.recordId, input.propertyId, input.value);
      return { seq, result };
    },
    onSuccess: ({ seq, result }) => {
      const recordId = result.record.id;
      const patchRecord = seq > (appliedRecords.current.get(recordId) ?? 0);
      const patchTotals = seq > appliedTotals.current;
      if (!patchRecord && !patchTotals) return;
      if (patchRecord) appliedRecords.current.set(recordId, seq);
      if (patchTotals) appliedTotals.current = seq;

      qc.setQueryData<CampaignTable>(["campaigns", campaignId], (previous) =>
        previous == null
          ? previous
          : {
              ...previous,
              records: patchRecord
                ? previous.records.map((record) =>
                    record.id === recordId ? result.record : record,
                  )
                : previous.records,
              totals: patchTotals ? result.totals : previous.totals,
            },
      );
    },
  });
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm run test:web -- src/features/campaigns/data/queries.test.tsx src/lib/http.test.ts`
Expected: PASS — the two new cases plus every case that was already green.

- [ ] **Step 7: Commit** (the user runs it)

```bash
git add apps/web/src/lib/http.ts \
        apps/web/src/features/campaigns/data/api.ts \
        apps/web/src/features/campaigns/data/queries.ts \
        apps/web/src/features/campaigns/data/queries.test.tsx
git commit -m "feat(web): write a cell value and patch the table cache from the answer"
```

---

### Task 3: The editable cell

**Files:**
- Create: `apps/web/src/components/EditableCell/EditableCell.tsx`
- Create: `apps/web/src/components/EditableCell/EditableCell.module.css`
- Test: `apps/web/src/components/EditableCell/EditableCell.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks. This component is domain-free and must stay so.
- Produces: `EditableCell` with props `{ display: string; value: string; label: string; editing: boolean; onOpen: () => void; onClose: (direction?: 1 | -1) => void; onSave: (raw: string) => Promise<void> }`. Task 5 renders it.

The component is **controlled**: it does not decide whether it is open. The parent does,
because `Tab` has to close one cell and open a different one, and only the parent knows
the grid. `onClose(direction)` reports which way the user tabbed; `undefined` means the
cell just closed.

- [ ] **Step 1: Write the failing test**

Create `EditableCell.test.tsx`:

```tsx
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableCell } from "./EditableCell.js";

/** Mirrors the parent's job: it owns which cell is open. */
function Harness({
  onSave = () => Promise.resolve(),
  onClose,
}: {
  onSave?: (raw: string) => Promise<void>;
  onClose?: (direction?: 1 | -1) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <EditableCell
      display="120.00"
      value="120"
      label="SPEND, 01 Aug"
      editing={editing}
      onOpen={() => setEditing(true)}
      onClose={(direction) => {
        setEditing(false);
        onClose?.(direction);
      }}
      onSave={onSave}
    />
  );
}

describe("EditableCell", () => {
  it("shows the formatted value at rest and opens an input with the raw value", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));

    expect(screen.getByRole("textbox", { name: "SPEND, 01 Aug" })).toHaveValue("120");
  });

  it("saves on Enter", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Enter}");

    expect(onSave).toHaveBeenCalledWith("200");
  });

  it("saves when the cell loses focus", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200");
    // Clicking away, not tabbing: `userEvent.tab()` would fire the Tab key handler and
    // this case has to exercise the blur path on its own.
    await userEvent.click(document.body);

    expect(onSave).toHaveBeenCalledWith("200");
  });

  it("discards the edit on Escape", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Escape}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "120.00" })).toBeInTheDocument();
  });

  it("saves nothing when the value was not changed", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
  });

  it("reports the direction when the user tabs out", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Tab}");

    expect(onClose).toHaveBeenCalledWith(1);
  });

  it("reports the other direction on Shift+Tab", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Shift>}{Tab}{/Shift}");

    expect(onClose).toHaveBeenCalledWith(-1);
  });

  it("shows the typed value while the save is in flight", async () => {
    let release = () => {};
    const onSave = () => new Promise<void>((resolve) => { release = resolve; });
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Enter}");

    const cell = screen.getByRole("button", { name: "200" });
    expect(cell).toHaveAttribute("data-state", "saving");
    release();
    await waitFor(() => expect(screen.getByRole("button", { name: "120.00" })).toBeInTheDocument());
  });

  it("shows the rejection reason and restores the stored value", async () => {
    const onSave = () => Promise.reject(new Error("Enter a number"));
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("abc{Enter}");

    const cell = await screen.findByRole("button", { name: "120.00" });
    expect(cell).toHaveAttribute("data-state", "error");
    expect(cell).toHaveAttribute("title", "Enter a number");
  });

  it("reopens a failed cell with the text last typed and clears the error", async () => {
    const onSave = vi.fn(() => Promise.reject(new Error("Enter a number")));
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "120.00" }));
    await userEvent.keyboard("abc{Enter}");
    await screen.findByRole("button", { name: "120.00" });
    await userEvent.click(screen.getByRole("button", { name: "120.00" }));

    expect(screen.getByRole("textbox", { name: "SPEND, 01 Aug" })).toHaveValue("abc");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- src/components/EditableCell/EditableCell.test.tsx`
Expected: FAIL — `Failed to resolve import "./EditableCell.js"`.

- [ ] **Step 3: Write the component**

Create `EditableCell.tsx`:

```tsx
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
      <input
        ref={inputRef}
        className={styles.input}
        aria-label={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit()}
      />
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
```

- [ ] **Step 4: Write the stylesheet**

Create `EditableCell.module.css`. Both elements inherit the table cell's typography and
alignment, so an open cell does not shift the column:

```css
.cell,
.input {
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: inherit;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 0 var(--space-1);
}

.cell {
  cursor: text;
}

.cell:hover,
.cell:focus-visible {
  border-color: var(--color-border);
}

.cell[data-state="saving"] {
  color: var(--color-text-muted);
}

.cell[data-state="error"] {
  border-color: var(--color-danger);
}

.input {
  outline: none;
  border-color: var(--color-accent);
  background: var(--color-bg);
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npm run test:web -- src/components/EditableCell/EditableCell.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit** (the user runs it)

```bash
git add apps/web/src/components/EditableCell/
git commit -m "feat(web): add an editable table cell"
```

---

### Task 4: Which cell is open, and where Tab goes next

**Files:**
- Create: `apps/web/src/features/campaigns/components/CampaignSheet/useSheetEditing.ts`
- Test: `apps/web/src/features/campaigns/components/CampaignSheet/useSheetEditing.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `interface CellPosition { recordId: string; propertyId: string }`; the pure function `nextCell(from: CellPosition, direction: 1 | -1, recordIds: string[], propertyIds: string[]): CellPosition | null`; and `useSheetEditing(recordIds: string[], propertyIds: string[])` returning `{ isEditing(recordId, propertyId): boolean; open(recordId, propertyId): void; close(from: CellPosition, direction?: 1 | -1): void }`. Task 5 uses the hook.

`propertyIds` holds the **editable** columns only, in display order. Computed columns
are absent from that list, which is exactly why `Tab` steps over them.

- [ ] **Step 1: Write the failing test**

Create `useSheetEditing.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { nextCell, useSheetEditing } from "./useSheetEditing.js";

const records = ["r1", "r2", "r3"];
// The computed columns are absent by construction, so stepping skips them.
const properties = ["p1", "p2"];

describe("nextCell", () => {
  it("steps to the next column in the same row", () => {
    expect(nextCell({ recordId: "r1", propertyId: "p1" }, 1, records, properties))
      .toEqual({ recordId: "r1", propertyId: "p2" });
  });

  it("crosses into the next row at the end of a row", () => {
    expect(nextCell({ recordId: "r1", propertyId: "p2" }, 1, records, properties))
      .toEqual({ recordId: "r2", propertyId: "p1" });
  });

  it("crosses into the previous row at the start of a row", () => {
    expect(nextCell({ recordId: "r2", propertyId: "p1" }, -1, records, properties))
      .toEqual({ recordId: "r1", propertyId: "p2" });
  });

  it("stops at the last cell of the last row instead of wrapping around", () => {
    expect(nextCell({ recordId: "r3", propertyId: "p2" }, 1, records, properties)).toBeNull();
  });

  it("stops at the first cell of the first row", () => {
    expect(nextCell({ recordId: "r1", propertyId: "p1" }, -1, records, properties)).toBeNull();
  });

  it("returns null for a cell that is no longer in the grid", () => {
    expect(nextCell({ recordId: "gone", propertyId: "p1" }, 1, records, properties)).toBeNull();
  });
});

describe("useSheetEditing", () => {
  it("opens one cell at a time", () => {
    const { result } = renderHook(() => useSheetEditing(records, properties));

    expect(result.current.isEditing("r1", "p1")).toBe(false);
    act(() => result.current.open("r1", "p1"));
    expect(result.current.isEditing("r1", "p1")).toBe(true);
    expect(result.current.isEditing("r1", "p2")).toBe(false);
  });

  it("closes without a direction", () => {
    const { result } = renderHook(() => useSheetEditing(records, properties));

    act(() => result.current.open("r1", "p1"));
    act(() => result.current.close({ recordId: "r1", propertyId: "p1" }));
    expect(result.current.isEditing("r1", "p1")).toBe(false);
  });

  it("moves the open cell when closed with a direction", () => {
    const { result } = renderHook(() => useSheetEditing(records, properties));

    act(() => result.current.open("r1", "p2"));
    act(() => result.current.close({ recordId: "r1", propertyId: "p2" }, 1));
    expect(result.current.isEditing("r2", "p1")).toBe(true);
  });

  it("leaves the grid at the last cell", () => {
    const { result } = renderHook(() => useSheetEditing(records, properties));

    act(() => result.current.open("r3", "p2"));
    act(() => result.current.close({ recordId: "r3", propertyId: "p2" }, 1));
    expect(result.current.isEditing("r3", "p2")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- src/features/campaigns/components/CampaignSheet/useSheetEditing.test.ts`
Expected: FAIL — `Failed to resolve import "./useSheetEditing.js"`.

- [ ] **Step 3: Write the implementation**

Create `useSheetEditing.ts`:

```ts
import { useState } from "react";

export interface CellPosition {
  recordId: string;
  propertyId: string;
}

/**
 * The cell one step away in reading order. `propertyIds` lists the editable columns
 * only, so computed ones are stepped over. Returns null at either end of the grid:
 * editing leaves rather than wrapping around.
 */
export function nextCell(
  from: CellPosition,
  direction: 1 | -1,
  recordIds: string[],
  propertyIds: string[],
): CellPosition | null {
  const row = recordIds.indexOf(from.recordId);
  const column = propertyIds.indexOf(from.propertyId);
  if (row < 0 || column < 0 || propertyIds.length === 0) return null;

  const target = row * propertyIds.length + column + direction;
  if (target < 0 || target >= recordIds.length * propertyIds.length) return null;

  return {
    recordId: recordIds[Math.floor(target / propertyIds.length)],
    propertyId: propertyIds[target % propertyIds.length],
  };
}

/** Holds the one open cell of a grid and the transitions between cells. */
export function useSheetEditing(recordIds: string[], propertyIds: string[]) {
  const [cell, setCell] = useState<CellPosition | null>(null);

  return {
    isEditing: (recordId: string, propertyId: string) =>
      cell?.recordId === recordId && cell.propertyId === propertyId,
    open: (recordId: string, propertyId: string) => setCell({ recordId, propertyId }),
    close: (from: CellPosition, direction?: 1 | -1) =>
      setCell(direction == null ? null : nextCell(from, direction, recordIds, propertyIds)),
  };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- src/features/campaigns/components/CampaignSheet/useSheetEditing.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit** (the user runs it)

```bash
git add apps/web/src/features/campaigns/components/CampaignSheet/useSheetEditing.ts \
        apps/web/src/features/campaigns/components/CampaignSheet/useSheetEditing.test.ts
git commit -m "feat(web): track the open sheet cell and where Tab moves it"
```

---

### Task 5: Wire editing into the sheet

**Files:**
- Modify: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx`
- Modify: `apps/web/src/i18n/en.ts:16`
- Test: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`
- Test: `apps/web/src/i18n/en.test.ts`

**Interfaces:**
- Consumes: `toInputValue`, `normalizeInput` (Task 1); `useSetValue` (Task 2); `EditableCell` (Task 3); `useSheetEditing` (Task 4).
- Produces: the finished feature. Nothing later depends on it inside this plan.

- [ ] **Step 1: Write the failing test**

In `CampaignSheet.test.tsx`, first give the fixture a genuinely computed column — CTR is
derived, and the current fixture wrongly gives it `formula: null`, which would make it
editable. Replace the `p2` line of the `properties` array with:

```tsx
    { id: "p2", key: "ctr", name: "CTR", type: "PERCENT", position: 1,
      formula: { kind: "const", value: "2" } },
```

Then append these cases:

```tsx
  it("opens an entered cell and leaves a computed one alone", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    expect(screen.getByRole("textbox", { name: "SPEND, 01 Aug" })).toHaveValue("120");

    // CTR is computed: its cell is plain text, with nothing to press.
    expect(screen.queryByRole("button", { name: "2.00%" })).not.toBeInTheDocument();
  });

  it("saves a cell and repaints the row and the totals from the answer", async () => {
    let gets = 0;
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => {
        gets += 1;
        return HttpResponse.json(table);
      }),
      mock.put("/api/records/r1/values/p1", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          record: { id: "r1", date: "2026-08-01", values: { p1: "200.0000", p2: "3.0000", p3: "good day" } },
          totals: { p1: "335.5000", p2: "2.5000", p3: null },
        });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Enter}");

    expect(await screen.findByRole("button", { name: "200.00" })).toBeInTheDocument();
    // The computed column and the footer follow from the same answer.
    expect(screen.getByRole("cell", { name: "3.00%" })).toBeInTheDocument();
    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    expect(within(footer).getByRole("cell", { name: "335.50" })).toBeInTheDocument();

    expect(received).toEqual({ value: "200" });
    // The proof that the cache was patched rather than refetched.
    expect(gets).toBe(1);
  });

  it("clears a cell when the input is emptied", async () => {
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          record: { id: "r1", date: "2026-08-01", values: { p1: null, p2: "2.0000", p3: "good day" } },
          totals: { p1: "135.5000", p2: "2.2500", p3: null },
        });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "SPEND, 01 Aug" }));
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(received).toEqual({ value: null }));
  });

  it("rejects input a numeric column cannot store without calling the API", async () => {
    let puts = 0;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", () => {
        puts += 1;
        return HttpResponse.json({ record: table.records[0], totals: table.totals });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    await userEvent.keyboard("abc{Enter}");

    const cell = await screen.findByRole("button", { name: "120.00" });
    await waitFor(() => expect(cell).toHaveAttribute("data-state", "error"));
    expect(cell).toHaveAttribute("title", "Enter a number");
    expect(puts).toBe(0);
  });

  it("shows the server's message when a write is refused", async () => {
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", () =>
        HttpResponse.json({ error: { message: "Cannot write to a computed property" } }, { status: 400 }),
      ),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Enter}");

    const cell = await screen.findByRole("button", { name: "120.00" });
    await waitFor(() =>
      expect(cell).toHaveAttribute("title", "Cannot write to a computed property"),
    );
  });

  it("tabs from the last entered column of a row into the next row", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    // SPEND and COMMENT are entered; CTR is computed and is stepped over.
    await userEvent.click(await screen.findByRole("button", { name: "good day" }));
    await userEvent.keyboard("{Tab}");

    expect(screen.getByRole("textbox", { name: "SPEND, 02 Aug" })).toBeInTheDocument();
  });
```

`i18n/en.test.ts` spot-checks two keys rather than walking the dictionary, so it needs no
new case; the copy is covered through the sheet's own error assertion above.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`
Expected: FAIL — no button is rendered for `120.00`, so the first click cannot resolve.

- [ ] **Step 3: Add the copy**

In `i18n/en.ts`, after the `"sheet.addDay"` line:

```ts
  "sheet.value.invalid": "Enter a number",
```

- [ ] **Step 4: Rewrite `CampaignSheet.tsx`**

The two new hooks have to run before the early returns for the pending and error states,
so the lists they take are read defensively and fall back to empty. Replace the whole
file with:

```tsx
import type { ReactNode } from "react";
import { DataTable, type DataColumn, type DataRow } from "../../../../components/DataTable/DataTable.js";
import { EditableCell } from "../../../../components/EditableCell/EditableCell.js";
import { EmptyState } from "../../../../components/EmptyState/EmptyState.js";
import { Button } from "../../../../components/Button/Button.js";
import { formatDay, formatValue, nextDay, todayIso } from "../../../../lib/format.js";
import { t } from "../../../../i18n/en.js";
import { useCampaignTable, useCreateRecord, useSetValue } from "../../data/queries.js";
import type { CampaignProperty, CampaignRecord } from "../../data/api.js";
import { normalizeInput, toInputValue } from "./sheetValue.js";
import { useSheetEditing } from "./useSheetEditing.js";
import styles from "./CampaignSheet.module.css";

/** Column id of the leading date column; property ids are uuids, so it cannot collide. */
const DATE_COLUMN = "date";

export interface CampaignSheetProps {
  campaignId: string;
}

/** The footer holds aggregates, which are computed and never editable. */
function totalCells(
  properties: CampaignProperty[],
  values: Record<string, string | null>,
): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const property of properties) {
    cells[property.id] = formatValue(values[property.id] ?? null, property.type);
  }
  return cells;
}

export function CampaignSheet({ campaignId }: CampaignSheetProps) {
  const table = useCampaignTable(campaignId);
  const addDay = useCreateRecord(campaignId);
  const setValue = useSetValue(campaignId);

  // Read before the early returns below: hooks may not sit behind a conditional return.
  const properties = table.data?.properties ?? [];
  const records = table.data?.records ?? [];
  const entered = properties.filter((property) => property.formula === null);
  const editing = useSheetEditing(
    records.map((record) => record.id),
    entered.map((property) => property.id),
  );

  function cell(record: CampaignRecord, property: CampaignProperty): ReactNode {
    const stored = record.values[property.id] ?? null;
    const display = formatValue(stored, property.type);
    if (property.formula !== null) return display;

    return (
      <EditableCell
        display={display}
        value={toInputValue(stored, property.type)}
        label={`${property.name}, ${formatDay(record.date)}`}
        editing={editing.isEditing(record.id, property.id)}
        onOpen={() => editing.open(record.id, property.id)}
        onClose={(direction) =>
          editing.close({ recordId: record.id, propertyId: property.id }, direction)
        }
        onSave={async (raw) => {
          let value: string | null;
          try {
            value = normalizeInput(raw, property.type);
          } catch {
            // The copy belongs to the app, not to the helper that raised the error.
            throw new Error(t("sheet.value.invalid"));
          }
          await setValue.mutateAsync({ recordId: record.id, propertyId: property.id, value });
        }}
      />
    );
  }

  if (table.isPending) return null;

  if (table.isError) {
    return (
      <EmptyState
        title={t("state.error.title")}
        action={
          <Button variant="ghost" size="sm" onClick={() => table.refetch()}>
            {t("state.retry")}
          </Button>
        }
      />
    );
  }

  const columns: DataColumn[] = [
    { id: DATE_COLUMN, label: t("sheet.date"), align: "left" },
    ...properties.map((property) => ({
      id: property.id,
      label: property.name,
      align: property.type === "TEXT" ? ("left" as const) : ("right" as const),
    })),
  ];

  const rows: DataRow[] = records.map((record) => ({
    id: record.id,
    cells: {
      [DATE_COLUMN]: formatDay(record.date),
      ...Object.fromEntries(properties.map((property) => [property.id, cell(record, property)])),
    },
  }));

  const footer: DataRow = {
    id: "totals",
    cells: { [DATE_COLUMN]: t("sheet.total"), ...totalCells(properties, table.data.totals) },
  };

  const lastRecord = records[records.length - 1];
  const nextDate = lastRecord != null ? nextDay(lastRecord.date) : todayIso();

  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t("sheet.title")}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addDay.mutate({ date: nextDate })}
          disabled={addDay.isPending}
        >
          + {t("sheet.addDay")}
        </Button>
      </div>
      <DataTable columns={columns} rows={rows} footer={footer} />
    </div>
  );
}
```

- [ ] **Step 5: Run the whole web suite and watch it pass**

Run: `npm run test:web`
Expected: PASS — the six new cases plus every existing one, `i18n/en.test.ts` included.

- [ ] **Step 6: Typecheck**

Run: `npm run build:web`
Expected: `tsc` reports no errors and Vite builds.

- [ ] **Step 7: Commit** (the user runs it)

```bash
git add apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx \
        apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx \
        apps/web/src/i18n/en.ts
git commit -m "feat(web): edit sheet cell values"
```

---

## Done when

- A click or Enter on an entered cell opens an input seeded with the raw value.
- Enter, `Tab` and losing focus save; `Esc` discards; an unchanged value sends nothing.
- `Tab` steps over computed columns, crosses row edges, and leaves the grid at the last cell.
- Emptying a cell clears it on the server.
- The entered cell, its computed columns and the TOTAL row all refresh from one `PUT`, with no refetch.
- Invalid numeric input never reaches the network and marks the cell; a refused write shows the server's message.
- `npm run test:web` and `npm run build:web` are green.
