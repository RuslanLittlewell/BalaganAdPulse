# AdPulse Campaign Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render each client's campaigns as selectable sheets — a tab strip above a table of day rows, metric columns and a totals row.

**Architecture:** Two domain-free components join the library (`Tabs`, `DataTable`). A new `features/campaigns/` layer fetches the campaign list and the pre-computed table from the existing REST API and feeds them to those components. `ClientPage` owns the campaign-list query, because it needs the first campaign for the redirect, and passes it down. All value formatting lives in one pure `lib/format.ts` module.

**Tech Stack:** React 19, TypeScript, react-router-dom v6, @tanstack/react-query v5, CSS Modules + design tokens, Vitest + jsdom + Testing Library + MSW.

**Spec:** [docs/superpowers/specs/2026-08-03-adpulse-campaign-sheets-design.md](../specs/2026-08-03-adpulse-campaign-sheets-design.md)

## Global Constraints

Shared conventions (English-only, Conventional Commits, TDD, testing setup, error
envelope) live in [conventions.md](../conventions.md). Phase-specific:

- **No utility-CSS framework, no component kit** — every component is hand-written as `Component.tsx` + `Component.module.css`.
- **`components/` may not import from `features/`** and may not name a domain concept. `Tabs` and `DataTable` must not mention campaigns, sheets or properties in their props or code.
- **Design tokens only** — components reference `var(--…)`; no literal colours, spacing or radii in component CSS.
- **UI copy** lives in `src/i18n/en.ts`, never inlined in JSX; read it through `t(key)`.
- **Values are strings** — the API sends numbers as strings with four decimals. Never parse them into `number` outside `lib/format.ts`, and never round-trip them back to the server.
- **Read-only** — no task adds a control that creates, edits, reorders or deletes anything. Such controls are not rendered at all, not rendered disabled.
- **Commits** — each task ends with a `Commit` step showing the exact command.

---

## File Structure

```
apps/web/src/
  lib/
    format.ts                      PropertyType union + formatValue + formatDay   (Task 1)
    format.test.ts
  components/
    Tabs/Tabs.tsx + .module.css    domain-free tab strip                          (Task 2)
    Tabs/Tabs.test.tsx
    DataTable/DataTable.tsx + .module.css   sticky-header/first-column grid       (Task 3)
    DataTable/DataTable.test.tsx
    EmptyState/EmptyState.tsx      gains an optional `action` slot                (Task 4)
  features/campaigns/
    data/api.ts                    payload types + endpoint wrappers              (Task 5)
    data/queries.ts                useCampaigns + useCampaignTable
    data/queries.test.tsx
    components/CampaignTabs/       campaign list -> Tabs -> navigation            (Task 6)
    components/CampaignSheet/      table payload -> DataTable                     (Task 7)
  features/clients/ClientPage/     owns useCampaigns, redirect, empty state       (Task 8)
  App.tsx                          second route with :campaignId                  (Task 8)
  i18n/en.ts                       new copy keys                                  (Tasks 7-8)
  test/handlers.ts                 default campaign handlers                      (Task 5)
```

**Why `ClientPage` owns the campaign-list query:** the redirect to the first campaign
needs the list, and so does the "client has no campaigns" empty state, which the spec
places above both the tabs and the table. Having `CampaignTabs` fetch it too would
mean two owners of one cache entry. `CampaignTabs` therefore receives the list as a
prop and owns only the mapping and the navigation. `CampaignSheet` owns its own table
query, since nothing above it needs the table.

---

### Task 1: Value formatting

**Files:**
- Create: `apps/web/src/lib/format.ts`
- Test: `apps/web/src/lib/format.test.ts`

**Interfaces:**
- Produces: `type PropertyType = "NUMBER" | "MONEY" | "PERCENT" | "TEXT"`; `formatValue(value: string | null, type: PropertyType): string`; `formatDay(iso: string): string`. Every later task imports `PropertyType` from here — `lib/` is the leaf layer, so both `components/` and `features/` may depend on it without a cycle.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/format.test.ts`:

```ts
import { formatValue, formatDay } from "./format.js";

describe("formatValue", () => {
  it("renders money with two decimals and grouped thousands", () => {
    expect(formatValue("120.0000", "MONEY")).toBe("120.00");
    expect(formatValue("1234567.8900", "MONEY")).toBe("1,234,567.89");
  });

  it("renders numbers without trailing zeros", () => {
    expect(formatValue("4500.0000", "NUMBER")).toBe("4,500");
    expect(formatValue("1234.5000", "NUMBER")).toBe("1,234.5");
  });

  it("renders percents with a suffix", () => {
    expect(formatValue("2.0000", "PERCENT")).toBe("2.00%");
  });

  it("passes text through untouched", () => {
    expect(formatValue("good day", "TEXT")).toBe("good day");
  });

  it("renders a dash for missing values", () => {
    expect(formatValue(null, "MONEY")).toBe("—");
    expect(formatValue(null, "TEXT")).toBe("—");
    expect(formatValue("", "NUMBER")).toBe("—");
  });
});

describe("formatDay", () => {
  it("renders an ISO date as day and short month", () => {
    expect(formatDay("2026-08-01")).toBe("01 Aug");
    expect(formatDay("2026-12-31")).toBe("31 Dec");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/lib/format.test.ts`
Expected: FAIL — `Failed to resolve import "./format.js"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/format.ts`:

```ts
/** The property types the API sends; also the display rules for a value. */
export type PropertyType = "NUMBER" | "MONEY" | "PERCENT" | "TEXT";

const MISSING = "—";

function grouped(value: number, minimumFractionDigits: number, maximumFractionDigits: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits, maximumFractionDigits });
}

/**
 * Values arrive as strings with four decimals to preserve precision, so parsing
 * happens here and nowhere else — the parsed number is for display only.
 */
export function formatValue(value: string | null, type: PropertyType): string {
  if (value === null || value === "") return MISSING;
  if (type === "TEXT") return value;

  const number = Number(value);
  if (!Number.isFinite(number)) return MISSING;

  if (type === "MONEY") return grouped(number, 2, 2);
  if (type === "PERCENT") return `${grouped(number, 2, 2)}%`;
  return grouped(number, 0, 2);
}

/** "2026-08-01" -> "01 Aug". Parsed as UTC so the local zone cannot shift the day. */
export function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/lib/format.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/format.ts apps/web/src/lib/format.test.ts
git commit -m "feat(web): add value and date formatting for sheet cells"
```

---

### Task 2: `Tabs` component

**Files:**
- Create: `apps/web/src/components/Tabs/Tabs.tsx`, `apps/web/src/components/Tabs/Tabs.module.css`
- Test: `apps/web/src/components/Tabs/Tabs.test.tsx`

**Interfaces:**
- Produces: `interface TabItem { id: string; label: string }`; `<Tabs items={TabItem[]} activeId={string | undefined} onSelect={(id: string) => void} />`. Knows nothing about routing or campaigns.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/Tabs/Tabs.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs.js";

const items = [
  { id: "a", label: "Search ads" },
  { id: "b", label: "Display" },
];

describe("Tabs", () => {
  it("renders a tab per item and marks the active one", () => {
    render(<Tabs items={items} activeId="b" onSelect={() => {}} />);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Display" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Search ads" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect with the item id", async () => {
    const onSelect = vi.fn();
    render(<Tabs items={items} activeId="a" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("tab", { name: "Display" }));

    expect(onSelect).toHaveBeenCalledWith("b");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/components/Tabs`
Expected: FAIL — `Failed to resolve import "./Tabs.js"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/Tabs/Tabs.tsx`:

```tsx
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  activeId?: string;
  onSelect: (id: string) => void;
}

export function Tabs({ items, activeId, onSelect }: TabsProps) {
  return (
    <div className={styles.tabs} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === activeId}
          className={styles.tab}
          data-active={item.id === activeId}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

Create `apps/web/src/components/Tabs/Tabs.module.css`:

```css
.tabs {
  display: flex;
  gap: var(--space-1);
  overflow-x: auto;
  border-bottom: 1px solid var(--color-border);
}

.tab {
  padding: var(--space-3) var(--space-4);
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.tab:hover {
  color: var(--color-text);
}

.tab[data-active="true"] {
  border-bottom-color: var(--color-accent);
  color: var(--color-text);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/components/Tabs`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Tabs
git commit -m "feat(web): add Tabs component"
```

---

### Task 3: `DataTable` component

**Files:**
- Create: `apps/web/src/components/DataTable/DataTable.tsx`, `apps/web/src/components/DataTable/DataTable.module.css`
- Test: `apps/web/src/components/DataTable/DataTable.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  type CellAlign = "left" | "right";
  interface DataColumn { id: string; label: string; align?: CellAlign }   // default "left"
  interface DataRow { id: string; cells: Record<string, ReactNode> }      // keyed by column id
  <DataTable columns={DataColumn[]} rows={DataRow[]} footer={DataRow | undefined} />
  ```
  The first column of every row renders as `<th scope="row">` so it can stick to the
  left edge and read as a row header. A footer row renders in `<tfoot>`; its label
  goes in the first column's cell like any other value.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/DataTable/DataTable.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { DataTable } from "./DataTable.js";

const columns = [
  { id: "date", label: "DATE" },
  { id: "spend", label: "SPEND", align: "right" as const },
];

const rows = [
  { id: "r1", cells: { date: "01 Aug", spend: "120.00" } },
  { id: "r2", cells: { date: "02 Aug", spend: "135.50" } },
];

describe("DataTable", () => {
  it("renders a header cell per column", () => {
    render(<DataTable columns={columns} rows={rows} />);

    expect(screen.getByRole("columnheader", { name: "DATE" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "SPEND" })).toBeInTheDocument();
  });

  it("renders a row per entry with cells in column order", () => {
    render(<DataTable columns={columns} rows={rows} />);

    const body = screen.getAllByRole("rowgroup")[1];
    const bodyRows = within(body).getAllByRole("row");
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0]).getByRole("rowheader")).toHaveTextContent("01 Aug");
    expect(within(bodyRows[0]).getByRole("cell")).toHaveTextContent("120.00");
  });

  it("renders the footer row when given one", () => {
    render(
      <DataTable columns={columns} rows={rows} footer={{ id: "totals", cells: { date: "TOTAL", spend: "255.50" } }} />,
    );

    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    expect(within(footer).getByRole("rowheader")).toHaveTextContent("TOTAL");
    expect(within(footer).getByRole("cell")).toHaveTextContent("255.50");
  });

  it("marks alignment on header and body cells", () => {
    render(<DataTable columns={columns} rows={rows} />);

    expect(screen.getByRole("columnheader", { name: "SPEND" })).toHaveAttribute("data-align", "right");
    expect(screen.getByRole("columnheader", { name: "DATE" })).toHaveAttribute("data-align", "left");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/components/DataTable`
Expected: FAIL — `Failed to resolve import "./DataTable.js"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/DataTable/DataTable.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export type CellAlign = "left" | "right";

export interface DataColumn {
  id: string;
  label: string;
  align?: CellAlign;
}

export interface DataRow {
  id: string;
  cells: Record<string, ReactNode>;
}

export interface DataTableProps {
  columns: DataColumn[];
  rows: DataRow[];
  footer?: DataRow;
}

/** The first column is a row header, so it can stick to the left edge while scrolling. */
function Cells({ columns, row }: { columns: DataColumn[]; row: DataRow }) {
  return (
    <>
      {columns.map((column, index) => {
        const align = column.align ?? "left";
        return index === 0 ? (
          <th key={column.id} scope="row" data-align={align} className={styles.rowHeader}>
            {row.cells[column.id]}
          </th>
        ) : (
          <td key={column.id} data-align={align}>
            {row.cells[column.id]}
          </td>
        );
      })}
    </>
  );
}

export function DataTable({ columns, rows, footer }: DataTableProps) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.id}
                scope="col"
                data-align={column.align ?? "left"}
                className={index === 0 ? styles.corner : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Cells columns={columns} row={row} />
            </tr>
          ))}
        </tbody>
        {footer != null && (
          <tfoot>
            <tr>
              <Cells columns={columns} row={footer} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
```

Create `apps/web/src/components/DataTable/DataTable.module.css`:

```css
.scroll {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  font-size: 14px;
}

.table th,
.table td {
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  white-space: nowrap;
}

.table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--color-surface);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  font-weight: 400;
}

.rowHeader,
.corner {
  position: sticky;
  left: 0;
  background: var(--color-surface);
}

.corner {
  z-index: 3;
}

.table tfoot th,
.table tfoot td {
  position: sticky;
  bottom: 0;
  background: var(--color-surface);
  font-weight: 700;
  border-top: 1px solid var(--color-border);
  border-bottom: none;
}

/* Numeric columns are the right-aligned ones; tabular figures keep them in line. */
.table [data-align="right"] {
  text-align: right;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.table [data-align="left"] {
  text-align: left;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/components/DataTable`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/DataTable
git commit -m "feat(web): add DataTable component"
```

---

### Task 4: `EmptyState` gains an action slot

**Files:**
- Modify: `apps/web/src/components/EmptyState/EmptyState.tsx`, `apps/web/src/components/EmptyState/EmptyState.module.css`
- Test: `apps/web/src/components/EmptyState/EmptyState.test.tsx`

**Interfaces:**
- Produces: `<EmptyState title description icon action />` where `action?: ReactNode` renders below the description. Tasks 6-8 use it to hang a retry button on the error state.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/components/EmptyState/EmptyState.test.tsx`, inside the existing
`describe`:

```tsx
  it("renders an action below the description", () => {
    render(<EmptyState title="Something went wrong" action={<button type="button">Retry</button>} />);

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/components/EmptyState`
Expected: FAIL — TypeScript rejects the unknown `action` prop, and the button is not found.

- [ ] **Step 3: Write the implementation**

In `apps/web/src/components/EmptyState/EmptyState.tsx`, add `action` to the props
interface and render it:

```tsx
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      {icon != null && <div className={styles.icon}>{icon}</div>}
      <h2 className={styles.title}>{title}</h2>
      {description != null && <p className={styles.description}>{description}</p>}
      {action != null && <div className={styles.action}>{action}</div>}
    </div>
  );
}
```

Append to `apps/web/src/components/EmptyState/EmptyState.module.css`:

```css
.action {
  margin-top: var(--space-3);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/components/EmptyState`
Expected: PASS — the existing test plus the new one.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/EmptyState
git commit -m "feat(web): add an action slot to EmptyState"
```

---

### Task 5: Campaign data layer

**Files:**
- Create: `apps/web/src/features/campaigns/data/api.ts`, `apps/web/src/features/campaigns/data/queries.ts`
- Modify: `apps/web/src/test/handlers.ts`
- Test: `apps/web/src/features/campaigns/data/queries.test.tsx`

**Interfaces:**
- Consumes: `PropertyType` from `lib/format.js` (Task 1); `http` from `lib/http.js`.
- Produces:
  ```ts
  interface CampaignSummary { id: string; clientId: string; name: string; position: number; createdAt: string; updatedAt: string }
  interface CampaignProperty { id: string; key: string | null; name: string; type: PropertyType; position: number; formula: unknown | null }
  interface CampaignRecord { id: string; date: string; values: Record<string, string | null> }
  interface CampaignTable { id: string; clientId: string; name: string; position: number; properties: CampaignProperty[]; records: CampaignRecord[]; totals: Record<string, string | null> }
  campaignsApi.list(clientId: string): Promise<CampaignSummary[]>
  campaignsApi.get(campaignId: string): Promise<CampaignTable>
  useCampaigns(clientId: string | undefined)      // key ["clients", clientId, "campaigns"]
  useCampaignTable(campaignId: string | undefined) // key ["campaigns", campaignId]
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/campaigns/data/queries.test.tsx`:

```tsx
import { http as mock, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { server } from "../../../test/server.js";
import { hookWrapper } from "../../../test/utils.js";
import { useCampaigns, useCampaignTable } from "./queries.js";

describe("useCampaigns", () => {
  it("loads the campaigns of one client", async () => {
    server.use(
      mock.get("/api/clients/1/campaigns", () =>
        HttpResponse.json([
          { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
        ]),
      ),
    );

    const { result } = renderHook(() => useCampaigns("1"), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("Search ads");
  });

  it("stays idle without a client id", () => {
    const { result } = renderHook(() => useCampaigns(undefined), { wrapper: hookWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useCampaignTable", () => {
  it("loads the computed table of one campaign", async () => {
    server.use(
      mock.get("/api/campaigns/c1", () =>
        HttpResponse.json({
          id: "c1",
          clientId: "1",
          name: "Search ads",
          position: 0,
          properties: [{ id: "p1", key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null }],
          records: [{ id: "r1", date: "2026-08-01", values: { p1: "120.0000" } }],
          totals: { p1: "120.0000" },
        }),
      ),
    );

    const { result } = renderHook(() => useCampaignTable("c1"), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.properties[0].name).toBe("SPEND");
    expect(result.current.data?.records[0].values.p1).toBe("120.0000");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/features/campaigns`
Expected: FAIL — `Failed to resolve import "./queries.js"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/features/campaigns/data/api.ts`:

```ts
import { http } from "../../../lib/http.js";
import type { PropertyType } from "../../../lib/format.js";

export interface CampaignSummary {
  id: string;
  clientId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignProperty {
  id: string;
  key: string | null;
  name: string;
  type: PropertyType;
  position: number;
  /** An expression tree; the server evaluates it, so the UI never reads inside. */
  formula: unknown | null;
}

export interface CampaignRecord {
  id: string;
  date: string;
  /** Keyed by property id; four-decimal strings, or null for an empty cell. */
  values: Record<string, string | null>;
}

export interface CampaignTable {
  id: string;
  clientId: string;
  name: string;
  position: number;
  properties: CampaignProperty[];
  records: CampaignRecord[];
  totals: Record<string, string | null>;
}

export const campaignsApi = {
  list: (clientId: string) => http.get<CampaignSummary[]>(`/clients/${clientId}/campaigns`),
  get: (campaignId: string) => http.get<CampaignTable>(`/campaigns/${campaignId}`),
};
```

Create `apps/web/src/features/campaigns/data/queries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { campaignsApi } from "./api.js";

export function useCampaigns(clientId: string | undefined) {
  return useQuery({
    queryKey: ["clients", clientId, "campaigns"],
    queryFn: () => campaignsApi.list(clientId as string),
    enabled: clientId != null,
  });
}

export function useCampaignTable(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", campaignId],
    queryFn: () => campaignsApi.get(campaignId as string),
    enabled: campaignId != null,
  });
}
```

Replace `apps/web/src/test/handlers.ts` so tests that render a client page have
campaign endpoints answered by default:

```ts
import { http, HttpResponse } from "msw";

export const defaultHandlers = [
  http.get("/api/clients", () => HttpResponse.json([])),
  http.get("/api/clients/:clientId/campaigns", () => HttpResponse.json([])),
];
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/features/campaigns`
Expected: PASS — 3 tests.

- [ ] **Step 5: Check nothing else broke**

Run: `npm run test:web`
Expected: PASS — every existing test still green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/campaigns apps/web/src/test/handlers.ts
git commit -m "feat(web): add campaigns api and query hooks"
```

---

### Task 6: `CampaignTabs`

**Files:**
- Create: `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.test.tsx`

**Interfaces:**
- Consumes: `Tabs`, `TabItem` (Task 2); `CampaignSummary` (Task 5).
- Produces: `<CampaignTabs clientId={string} campaigns={CampaignSummary[]} activeCampaignId={string | undefined} />`. Navigates to `/clients/:clientId/campaigns/:campaignId` on select. It does not fetch — Task 8 passes the list in.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "../../../../test/utils.js";
import { CampaignTabs } from "./CampaignTabs.js";
import type { CampaignSummary } from "../../data/api.js";

const campaigns: CampaignSummary[] = [
  { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
  { id: "c2", clientId: "1", name: "Display", position: 1, createdAt: "", updatedAt: "" },
];

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("CampaignTabs", () => {
  it("renders a tab per campaign and marks the active one", () => {
    renderWithProviders(<CampaignTabs clientId="1" campaigns={campaigns} activeCampaignId="c2" />);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Display" })).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to the campaign route on select", async () => {
    renderWithProviders(
      <>
        <CampaignTabs clientId="1" campaigns={campaigns} activeCampaignId="c1" />
        <LocationProbe />
      </>,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Display" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/clients/1/campaigns/c2");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignTabs`
Expected: FAIL — `Failed to resolve import "./CampaignTabs.js"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import { Tabs } from "../../../../components/Tabs/Tabs.js";
import type { CampaignSummary } from "../../data/api.js";

export interface CampaignTabsProps {
  clientId: string;
  campaigns: CampaignSummary[];
  activeCampaignId?: string;
}

export function CampaignTabs({ clientId, campaigns, activeCampaignId }: CampaignTabsProps) {
  const navigate = useNavigate();

  return (
    <Tabs
      items={campaigns.map((campaign) => ({ id: campaign.id, label: campaign.name }))}
      activeId={activeCampaignId}
      onSelect={(campaignId) => navigate(`/clients/${clientId}/campaigns/${campaignId}`)}
    />
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignTabs`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/campaigns/components/CampaignTabs
git commit -m "feat(web): add campaign tab strip"
```

---

### Task 7: `CampaignSheet`

**Files:**
- Create: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`

**Interfaces:**
- Consumes: `DataTable`, `DataColumn`, `DataRow` (Task 3); `EmptyState` `action` slot (Task 4); `useCampaignTable` (Task 5); `formatValue`, `formatDay` (Task 1).
- Produces: `<CampaignSheet campaignId={string} />` — owns its own table query and every state around it.

- [ ] **Step 1: Add the copy keys**

In `apps/web/src/i18n/en.ts`, add to the `en` object after the `client.*` entries:

```ts
  "sheet.date": "DATE",
  "sheet.total": "TOTAL",
  "sheet.empty.title": "No days yet",
  "sheet.empty.description": "This sheet has no records",
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`:

```tsx
import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import { server } from "../../../../test/server.js";
import { renderWithProviders } from "../../../../test/utils.js";
import { CampaignSheet } from "./CampaignSheet.js";

const table = {
  id: "c1",
  clientId: "1",
  name: "Search ads",
  position: 0,
  properties: [
    { id: "p1", key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
    { id: "p2", key: "ctr", name: "CTR", type: "PERCENT", position: 1, formula: null },
    { id: "p3", key: "comment", name: "COMMENT", type: "TEXT", position: 2, formula: null },
  ],
  records: [
    { id: "r1", date: "2026-08-01", values: { p1: "120.0000", p2: "2.0000", p3: "good day" } },
    { id: "r2", date: "2026-08-02", values: { p1: "135.5000", p2: "1.9900", p3: null } },
  ],
  totals: { p1: "255.5000", p2: "2.2500", p3: null },
};

describe("CampaignSheet", () => {
  it("renders a column per property, a row per record and the totals row", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    expect(await screen.findByRole("columnheader", { name: "SPEND" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "DATE" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "COMMENT" })).toBeInTheDocument();

    expect(screen.getByRole("rowheader", { name: "01 Aug" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "120.00" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2.00%" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "good day" })).toBeInTheDocument();

    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    expect(within(footer).getByRole("rowheader")).toHaveTextContent("TOTAL");
    expect(within(footer).getByRole("cell", { name: "255.50" })).toBeInTheDocument();
    expect(within(footer).getByRole("cell", { name: "2.25%" })).toBeInTheDocument();
  });

  it("renders a dash for an empty cell", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    expect(await screen.findAllByRole("cell", { name: "—" })).toHaveLength(2);
  });

  it("shows an empty state when the campaign has no records", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json({ ...table, records: [] })));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    expect(await screen.findByText("No days yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error state with a retry button when the request fails", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json({}, { status: 500 })));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignSheet`
Expected: FAIL — `Failed to resolve import "./CampaignSheet.js"`.

- [ ] **Step 4: Write the implementation**

Create `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx`:

```tsx
import { DataTable, type DataColumn, type DataRow } from "../../../../components/DataTable/DataTable.js";
import { EmptyState } from "../../../../components/EmptyState/EmptyState.js";
import { Button } from "../../../../components/Button/Button.js";
import { formatDay, formatValue } from "../../../../lib/format.js";
import { t } from "../../../../i18n/en.js";
import { useCampaignTable } from "../../data/queries.js";
import type { CampaignProperty } from "../../data/api.js";

/** Column id of the leading date column; property ids are uuids, so it cannot collide. */
const DATE_COLUMN = "date";

export interface CampaignSheetProps {
  campaignId: string;
}

function valueCells(
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

  const { properties, records, totals } = table.data;

  if (records.length === 0) {
    return <EmptyState title={t("sheet.empty.title")} description={t("sheet.empty.description")} />;
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
    cells: { [DATE_COLUMN]: formatDay(record.date), ...valueCells(properties, record.values) },
  }));

  const footer: DataRow = {
    id: "totals",
    cells: { [DATE_COLUMN]: t("sheet.total"), ...valueCells(properties, totals) },
  };

  return <DataTable columns={columns} rows={rows} footer={footer} />;
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignSheet`
Expected: PASS — 4 tests.

If the error-state test times out, the shared `createQueryClient` is retrying failed
queries. Check `src/lib/queryClient.ts`: it must set `retry: false` for tests to see
the error state promptly. It already does for the clients feature — do not change it.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/campaigns/components/CampaignSheet apps/web/src/i18n/en.ts
git commit -m "feat(web): render a campaign as a sheet table"
```

---

### Task 8: Wire sheets into `ClientPage`

**Files:**
- Modify: `apps/web/src/App.tsx`, `apps/web/src/features/clients/ClientPage/ClientPage.tsx`, `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/clients/ClientPage/ClientPage.test.tsx`

**Interfaces:**
- Consumes: `useCampaigns` (Task 5), `CampaignTabs` (Task 6), `CampaignSheet` (Task 7).
- Produces: the finished feature — `/clients/:clientId/campaigns/:campaignId` renders header, tabs and sheet; `/clients/:clientId` redirects to the first campaign.

- [ ] **Step 1: Add the copy keys**

In `apps/web/src/i18n/en.ts`, add after the `sheet.*` entries:

```ts
  "campaigns.empty.title": "No sheets yet",
  "campaigns.empty.description": "This client has no campaigns",
```

- [ ] **Step 2: Extend the test file's route harness**

`apps/web/src/features/clients/ClientPage/ClientPage.test.tsx` already has a `setup`
helper and a shared `client` fixture. The redirect can only happen if the campaign
route exists in that harness, so add it:

```tsx
function setup(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<EmptyState title="root" />} />
      <Route path="/clients/:clientId" element={<ClientPage />} />
      <Route path="/clients/:clientId/campaigns/:campaignId" element={<ClientPage />} />
    </Routes>,
    { route },
  );
}
```

- [ ] **Step 3: Write the failing test**

Append to the existing `describe("ClientPage")` in the same file:

```tsx
  it("redirects to the first campaign when the URL has none", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () =>
        HttpResponse.json([
          { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
        ]),
      ),
      mock.get("/api/campaigns/c1", () =>
        HttpResponse.json({
          id: "c1", clientId: "1", name: "Search ads", position: 0,
          properties: [], records: [], totals: {},
        }),
      ),
    );

    setup("/clients/1");

    expect(await screen.findByRole("tab", { name: "Search ads" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an empty state when the client has no campaigns", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () => HttpResponse.json([])),
    );

    setup("/clients/1");

    expect(await screen.findByText("No sheets yet")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
```

- [ ] **Step 4: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/features/clients/ClientPage`
Expected: FAIL — no `tab` role is rendered and "No sheets yet" is not found.

- [ ] **Step 5: Write the implementation**

In `apps/web/src/App.tsx`, add the campaign route beside the existing client route:

```tsx
            <Route path="/clients/:clientId" element={<ClientPage />} />
            <Route path="/clients/:clientId/campaigns/:campaignId" element={<ClientPage />} />
```

In `apps/web/src/features/clients/ClientPage/ClientPage.tsx`, add the imports:

```tsx
import { useEffect } from "react";
import { useCampaigns } from "../../campaigns/data/queries.js";
import { CampaignTabs } from "../../campaigns/components/CampaignTabs/CampaignTabs.js";
import { CampaignSheet } from "../../campaigns/components/CampaignSheet/CampaignSheet.js";
```

Read `campaignId` from the route, load the campaigns, and redirect when the URL has no
selection. Both hooks must run before the existing `if (clients.isPending) return null`
guard — hooks cannot sit after an early return:

```tsx
  const { clientId, campaignId } = useParams();
  const navigate = useNavigate();
  const clients = useClients();
  const campaigns = useCampaigns(clientId);
  const remove = useDeleteClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const firstCampaignId = campaigns.data?.[0]?.id;
  useEffect(() => {
    if (campaignId == null && firstCampaignId != null) {
      navigate(`/clients/${clientId}/campaigns/${firstCampaignId}`, { replace: true });
    }
  }, [campaignId, firstCampaignId, clientId, navigate]);

  if (clients.isPending) return null;
```

Then render the tabs and the sheet under the existing `ClientHeader`, before the two
dialogs:

```tsx
      <ClientHeader client={client} onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)} />

      {campaigns.isError && (
        <EmptyState
          title={t("state.error.title")}
          action={
            <Button variant="ghost" size="sm" onClick={() => campaigns.refetch()}>
              {t("state.retry")}
            </Button>
          }
        />
      )}

      {campaigns.isSuccess && campaigns.data.length === 0 && (
        <EmptyState title={t("campaigns.empty.title")} description={t("campaigns.empty.description")} />
      )}

      {campaigns.isSuccess && campaigns.data.length > 0 && (
        <>
          <CampaignTabs clientId={client.id} campaigns={campaigns.data} activeCampaignId={campaignId} />
          {campaignId != null && <CampaignSheet campaignId={campaignId} />}
        </>
      )}
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/features/clients/ClientPage`
Expected: PASS — the existing tests plus the two new ones.

- [ ] **Step 7: Run the whole suite and the typechecker**

Run: `npm run test:web && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: every test passes; `tsc` prints nothing.

- [ ] **Step 8: See it in the real app**

Run: `npm run dev:all`, open `http://localhost:5173`, select a client. If the client
has no campaigns, create one against the API to see a sheet:

```bash
curl -X POST http://localhost:3000/api/clients/<clientId>/campaigns \
  -H 'Content-Type: application/json' -d '{"name":"Search ads"}'
```

Confirm: tabs appear, the URL gains `/campaigns/<id>`, the table shows the eleven
default columns with an empty-days state, and switching tabs swaps the sheet.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/features/clients/ClientPage apps/web/src/i18n/en.ts
git commit -m "feat(web): show campaign sheets on the client page"
```

---

## Done when

- `/clients/:clientId` redirects to the client's first campaign; `/clients/:clientId/campaigns/:campaignId` renders header, tabs and sheet.
- The sheet shows a `DATE` column, one column per property in order, one row per day, and a `TOTAL` footer row, formatted per property type.
- A client with no campaigns, a campaign with no days, and a failed request each render their own state.
- `npm run test:web` and `npx tsc --noEmit -p apps/web/tsconfig.json` are clean.
