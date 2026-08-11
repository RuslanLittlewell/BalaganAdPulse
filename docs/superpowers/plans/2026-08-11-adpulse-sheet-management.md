# AdPulse Sheet Deletion and Day Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the sheet strip — the active tab's underline spans its controls, a sheet can be deleted, and a sheet renders its columns with a header row and an add-day button from the moment it is created.

**Architecture:** `Tabs` generalises its single icon slot into an array of item actions, so the feature decides how many controls a tab carries and hides delete when only one sheet remains. `CampaignSheet` stops short-circuiting on an empty sheet and grows a header row; adding a day posts the day after the last row and invalidates the table query so rows and totals refresh together.

**Tech Stack:** React 19, TypeScript, react-router-dom v6, @tanstack/react-query v5, CSS Modules + design tokens, Vitest + jsdom + Testing Library + MSW. Backend unchanged — every endpoint used here already exists.

**Spec:** none — this is a follow-up slice on
[2026-08-03-adpulse-campaign-sheets-design.md](../specs/2026-08-03-adpulse-campaign-sheets-design.md)
and the Phase 5 plan
[2026-08-05-adpulse-campaign-management.md](2026-08-05-adpulse-campaign-management.md).
Their constraints still bind; this plan lifts the read-only rule for sheet deletion and
day creation only.

## Global Constraints

Shared conventions (English-only, Conventional Commits, TDD, testing setup, error
envelope) live in [conventions.md](../conventions.md). Phase-specific:

- **No utility-CSS framework, no component kit, no icon library** — hand-written `Component.tsx` + `Component.module.css`; icons are inline SVG.
- **`components/` may not import from `features/`** and may not name a domain concept. `Tabs`, `PencilIcon` and `CrossIcon` must not mention campaigns, sheets, renaming or deleting.
- **Design tokens only** — colours, spacing and radii come from `var(--…)`. Structural values (border widths, `flex-shrink`, `font-size`) may be literals.
- **UI copy** lives in `src/i18n/en.ts`, read through `t(key)`, never inlined in JSX. The app is English-only: the sheet title is **"Daily statistics"**.
- **Reordering stays unbuilt** — `PATCH /api/campaigns/:id` accepts `position`, but no UI may send it and no drag affordance is rendered.
- **A client always keeps at least one sheet** — the delete control is not rendered at all when the client has exactly one sheet, matching the invariant the `Main` seeding established. Not rendered disabled; absent.
- **No backend changes** — every endpoint this plan uses already exists and is tested.

---

## File Structure

```
apps/web/src/
  components/Tabs/Tabs.tsx + .module.css     itemActions array; underline on the item   (Task 1)
  components/CrossIcon/CrossIcon.tsx         inline SVG, sibling of PencilIcon          (Task 3)
  features/campaigns/data/api.ts             + campaignsApi.remove, recordsApi.create   (Tasks 2, 5)
  features/campaigns/data/queries.ts         + useDeleteCampaign, useCreateRecord       (Tasks 2, 5)
  lib/format.ts                              + nextDay, todayIso                        (Task 5)
  features/campaigns/components/CampaignTabs/   conditional delete action               (Task 3)
  features/campaigns/components/CampaignSheet/  always render the table; header row     (Task 6)
    CampaignSheet.module.css                 spacing, header layout                     (Task 6)
  features/clients/ClientPage/ClientPage.tsx delete confirmation + neighbour navigation (Task 4)
  i18n/en.ts                                 new copy keys; two removed                 (Tasks 3, 4, 6)
```

**Why `itemActions` replaces `itemAction`:** the strip now carries two controls per active
tab and must show only one of them when a single sheet remains. An array lets the feature
decide the count; a second ad-hoc prop would not, and `Tabs` has exactly one consumer, so
widening the type costs nothing.

**Why the delete confirmation lives in `ClientPage`:** it already owns the campaign list,
the create dialog and the rename dialog, and it is the only place that knows which sheet
to select after one is removed. `CampaignTabs` keeps reporting intent upward.

---

### Task 1: The underline spans the tab's controls, and the add button stops shrinking

**Files:**
- Modify: `apps/web/src/components/Tabs/Tabs.tsx`, `apps/web/src/components/Tabs/Tabs.module.css`, `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.tsx`
- Test: `apps/web/src/components/Tabs/Tabs.test.tsx`

**Interfaces:**
- Produces: `itemActions?: TabItemAction[]` replacing `itemAction?: TabItemAction` on `TabsProps`. `TabItemAction` keeps its shape: `{ icon: ReactNode; label: string; onSelect: (id: string) => void }`. Actions render in array order inside the active tab only.
- Consumes: nothing new.

**Context:** three defects are fixed together because they are one stylesheet and one
component. The active underline is currently `border-bottom` on the `.tab` button, so it
stops at the label and excludes the icon buttons beside it; it moves to the `.item`
wrapper. The trailing `.action` has `margin-left: auto` but no `flex-shrink: 0`, so once
the tabs fill the row the add button compresses instead of the tab list scrolling.

`CampaignTabs` currently passes `itemAction={{…}}`; this task updates that call site to
pass a one-element `itemActions` array so the app keeps building. Task 3 adds the second
action.

- [ ] **Step 1: Write the failing test**

Replace the two `itemAction` tests in `apps/web/src/components/Tabs/Tabs.test.tsx` — the
one asserting the action renders on the active tab and the one asserting no stray buttons
without it — with these three. The file already defines `items` and imports `render`,
`screen`, `userEvent` and `Tabs`:

```tsx
  it("renders every item action on the active tab, in order, each reporting its id", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <Tabs
        items={items}
        activeId="b"
        onSelect={() => {}}
        itemActions={[
          { icon: <span>pencil</span>, label: "Rename", onSelect: onEdit },
          { icon: <span>cross</span>, label: "Delete", onSelect: onDelete },
        ]}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Rename", "Delete"]);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("b");
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("renders item actions on the active tab only", () => {
    render(
      <Tabs
        items={items}
        activeId="a"
        onSelect={() => {}}
        itemActions={[{ icon: <span>pencil</span>, label: "Rename", onSelect: () => {} }]}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Rename" })).toHaveLength(1);
  });

  it("renders no item action when none is given", () => {
    render(<Tabs items={items} activeId="a" onSelect={() => {}} />);

    // The tabs carry role="tab", so nothing should match the plain button role.
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/components/Tabs`
Expected: FAIL — TypeScript rejects the unknown `itemActions` prop and the buttons are not
found. The other pre-existing `Tabs` tests still pass.

- [ ] **Step 3: Update the component**

In `apps/web/src/components/Tabs/Tabs.tsx`, rename the prop to an array and render each
action. The `role="presentation"` wrapper now also carries `data-active`, because the
underline moves onto it:

```tsx
export interface TabsProps {
  items: TabItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  action?: ReactNode;
  itemActions?: TabItemAction[];
}

export function Tabs({ items, activeId, onSelect, action, itemActions }: TabsProps) {
  return (
    <div className={styles.strip}>
      <div className={styles.tabs} role="tablist">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            // A plain wrapper so the icon buttons are siblings of the tab, not nested
            // inside it; `presentation` keeps it out of the tablist's child semantics.
            // Deliberate tradeoff: the item actions still render inside the tablist so they
            // stay visually inside the active tab, making this wrapper a non-tab child of
            // `role="tablist"`. Completing the full ARIA tabs pattern is deferred.
            // `data-active` lives here too: the active underline spans the whole group.
            <div key={item.id} className={styles.item} role="presentation" data-active={active}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={styles.tab}
                data-active={active}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
              {active &&
                itemActions?.map((itemAction) => (
                  <button
                    key={itemAction.label}
                    type="button"
                    className={styles.itemAction}
                    aria-label={itemAction.label}
                    onClick={() => itemAction.onSelect(item.id)}
                  >
                    {itemAction.icon}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      {action != null && <div className={styles.action}>{action}</div>}
    </div>
  );
}
```

The `key` is the action's label, which is its accessible name and therefore unique within
a strip.

- [ ] **Step 4: Move the underline and stop the shrink**

In `apps/web/src/components/Tabs/Tabs.module.css`, change exactly these four rules; leave
the rest of the file as it is:

```css
.tabs {
  display: flex;
  gap: var(--space-1);
  overflow-x: auto;
  min-width: 0;
}

.item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border-bottom: 2px solid transparent;
}

.item[data-active="true"] {
  border-bottom-color: var(--color-accent);
}

.action {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}
```

and remove the two border declarations from `.tab`, so it keeps only its padding, colour
and `white-space`:

```css
.tab {
  padding: var(--space-3) var(--space-4);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  white-space: nowrap;
}
```

`.tab[data-active="true"]` keeps `color: var(--color-text)` and loses
`border-bottom-color`.

- [ ] **Step 5: Update the one consumer**

In `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.tsx`, change the
prop to an array — the content is unchanged:

```tsx
      itemActions={[{ icon: <PencilIcon />, label: t("campaigns.rename"), onSelect: onRename }]}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run --root apps/web src/components/Tabs src/features/campaigns src/features/clients`
Expected: PASS — the `Tabs` tests plus both consumers.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/Tabs apps/web/src/features/campaigns/components/CampaignTabs
git commit -m "feat(web): let a tab carry several item actions under one underline"
```

---

### Task 2: Campaign deletion on the data layer

**Files:**
- Modify: `apps/web/src/features/campaigns/data/api.ts`, `apps/web/src/features/campaigns/data/queries.ts`
- Test: `apps/web/src/features/campaigns/data/queries.test.tsx`

**Interfaces:**
- Produces: `campaignsApi.remove(campaignId: string): Promise<void>` and `useDeleteCampaign(clientId: string)` — mutate takes the campaign id as a bare string. Invalidates `["clients", clientId, "campaigns"]`.

**Context:** `http.del` already exists in `lib/http.ts` and returns `Promise<void>`,
handling the 204 by returning `undefined`. The server cascades: deleting a campaign
removes its properties, records and values.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/features/campaigns/data/queries.test.tsx`, extending its import from
`./queries.js` with `useDeleteCampaign`:

```tsx
describe("useDeleteCampaign", () => {
  it("sends DELETE for one campaign", async () => {
    let method = "";
    server.use(
      mock.delete("/api/campaigns/c1", ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDeleteCampaign("1"), { wrapper: hookWrapper() });
    await result.current.mutateAsync("c1");

    expect(method).toBe("DELETE");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/features/campaigns/data`
Expected: FAIL — `useDeleteCampaign` is not exported.

- [ ] **Step 3: Add the endpoint wrapper**

In `apps/web/src/features/campaigns/data/api.ts`, add to the `campaignsApi` object,
leaving `list`, `get`, `create` and `update` untouched:

```ts
  remove: (campaignId: string) => http.del(`/campaigns/${campaignId}`),
```

- [ ] **Step 4: Add the hook**

In `apps/web/src/features/campaigns/data/queries.ts`, append:

```ts
export function useDeleteCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) => campaignsApi.remove(campaignId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", clientId, "campaigns"] }),
  });
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/features/campaigns/data`
Expected: PASS — the existing query and mutation tests plus the new one.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/campaigns/data
git commit -m "feat(web): add the sheet delete mutation"
```

---

### Task 3: `CrossIcon` and the conditional delete control

**Files:**
- Create: `apps/web/src/components/CrossIcon/CrossIcon.tsx`, `apps/web/src/components/CrossIcon/CrossIcon.test.tsx`
- Modify: `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.tsx`, `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.test.tsx`

**Interfaces:**
- Consumes: `itemActions` from Task 1.
- Produces: `<CrossIcon />`; `<CampaignTabs … onDelete={(campaignId: string) => void} />`. The delete action is present only when `campaigns.length > 1`.

- [ ] **Step 1: Add the copy key**

In `apps/web/src/i18n/en.ts`, add after `"campaigns.rename"`:

```ts
  "campaigns.delete": "Delete sheet",
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/src/components/CrossIcon/CrossIcon.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { CrossIcon } from "./CrossIcon.js";

describe("CrossIcon", () => {
  it("renders a decorative svg that inherits the text colour", () => {
    const { container } = render(<CrossIcon />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
  });
});
```

Add to the existing `describe("CampaignTabs")` in
`apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.test.tsx`. Its
existing tests render `<CampaignTabs … onNew={…} onRename={…} />`; update those call sites
to also pass `onDelete={() => {}}`, then add:

```tsx
  it("calls onDelete with the active campaign id", async () => {
    const onDelete = vi.fn();
    renderWithProviders(
      <CampaignTabs
        clientId="1"
        campaigns={campaigns}
        activeCampaignId="c2"
        onNew={() => {}}
        onRename={() => {}}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete sheet" }));

    expect(onDelete).toHaveBeenCalledWith("c2");
  });

  it("offers no delete control when the client has a single sheet", () => {
    renderWithProviders(
      <CampaignTabs
        clientId="1"
        campaigns={[campaigns[0]]}
        activeCampaignId="c1"
        onNew={() => {}}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Rename sheet" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete sheet" })).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run --root apps/web src/components/CrossIcon src/features/campaigns/components/CampaignTabs`
Expected: FAIL — `CrossIcon` does not resolve, and `onDelete` is an unknown prop.

- [ ] **Step 4: Write the icon**

Create `apps/web/src/components/CrossIcon/CrossIcon.tsx`:

```tsx
/** Decorative — the button that wraps it carries the accessible name. */
export function CrossIcon() {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
```

- [ ] **Step 5: Build the action list in the feature**

Replace `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.tsx` with:

```tsx
import { useNavigate } from "react-router-dom";
import { Tabs, type TabItemAction } from "../../../../components/Tabs/Tabs.js";
import { Button } from "../../../../components/Button/Button.js";
import { PencilIcon } from "../../../../components/PencilIcon/PencilIcon.js";
import { CrossIcon } from "../../../../components/CrossIcon/CrossIcon.js";
import { t } from "../../../../i18n/en.js";
import type { CampaignSummary } from "../../data/api.js";

export interface CampaignTabsProps {
  clientId: string;
  campaigns: CampaignSummary[];
  activeCampaignId?: string;
  onNew: () => void;
  onRename: (campaignId: string) => void;
  onDelete: (campaignId: string) => void;
}

export function CampaignTabs({
  clientId, campaigns, activeCampaignId, onNew, onRename, onDelete,
}: CampaignTabsProps) {
  const navigate = useNavigate();

  const itemActions: TabItemAction[] = [
    { icon: <PencilIcon />, label: t("campaigns.rename"), onSelect: onRename },
  ];
  // A client keeps at least one sheet, so the last one offers no delete control.
  if (campaigns.length > 1) {
    itemActions.push({ icon: <CrossIcon />, label: t("campaigns.delete"), onSelect: onDelete });
  }

  return (
    <Tabs
      items={campaigns.map((campaign) => ({ id: campaign.id, label: campaign.name }))}
      activeId={activeCampaignId}
      onSelect={(campaignId) => navigate(`/clients/${clientId}/campaigns/${campaignId}`)}
      itemActions={itemActions}
      action={
        <Button variant="ghost" size="sm" onClick={onNew}>
          + {t("campaigns.new")}
        </Button>
      }
    />
  );
}
```

- [ ] **Step 6: Keep the existing `ClientPage` call site compiling**

`ClientPage` renders `CampaignTabs` and must now pass the required `onDelete`. Add a
temporary no-op there — Task 4 replaces it:

```tsx
            onDelete={() => {}}
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npx vitest run --root apps/web src/components/CrossIcon src/features/campaigns src/features/clients`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/CrossIcon apps/web/src/features/campaigns/components/CampaignTabs \
        apps/web/src/features/clients/ClientPage/ClientPage.tsx apps/web/src/i18n/en.ts
git commit -m "feat(web): add the sheet delete control to the tab strip"
```

---

### Task 4: Confirm the deletion and pick the next sheet

**Files:**
- Modify: `apps/web/src/features/clients/ClientPage/ClientPage.tsx`, `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/clients/ClientPage/ClientPage.test.tsx`

**Interfaces:**
- Consumes: `useDeleteCampaign(clientId)` (Task 2), `CampaignTabs`'s `onDelete` (Task 3).
- Produces: the finished delete flow — a confirmation dialog naming the sheet, and navigation to the neighbouring sheet after the active one is removed.

**Context:** deleting a sheet cascades away every day and value it holds, so it is
confirmed. The page already renders a delete confirmation for the *client* — follow that
block's shape exactly, including the `danger` button variant.

After deleting the sheet that is currently open, the URL still points at it, so the page
must navigate. Prefer the previous sibling; when the deleted sheet was first, take the one
that follows it.

- [ ] **Step 1: Add the copy keys**

In `apps/web/src/i18n/en.ts`, add after `"campaigns.delete"`:

```ts
  "campaigns.delete.title": "Delete sheet?",
  "campaigns.delete.body": "This permanently deletes the sheet and all of its days.",
```

- [ ] **Step 2: Write the failing test**

Add to the existing `describe("ClientPage")` in
`apps/web/src/features/clients/ClientPage/ClientPage.test.tsx`, adding `within` to its
import from `@testing-library/react`.

The confirm button must be queried **inside the dialog**: `ClientHeader` renders a
`Delete` button for the *client*, so an unscoped `getByRole("button", { name: "Delete" })`
matches two elements and throws.

```tsx
  it("confirms a sheet deletion and opens the neighbouring sheet", async () => {
    let listed = [
      { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
      { id: "c2", clientId: "1", name: "Display", position: 1, createdAt: "", updatedAt: "" },
    ];
    const table = (id: string, name: string) => ({
      id, clientId: "1", name, position: 0, properties: [], records: [], totals: {},
    });
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () => HttpResponse.json(listed)),
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table("c1", "Search ads"))),
      mock.get("/api/campaigns/c2", () => HttpResponse.json(table("c2", "Display"))),
      mock.delete("/api/campaigns/c2", () => {
        listed = [listed[0]];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    setup("/clients/1/campaigns/c2");

    await userEvent.click(await screen.findByRole("button", { name: "Delete sheet" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("tab", { name: "Search ads" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Display" })).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/features/clients/ClientPage`
Expected: FAIL — clicking the cross does nothing, so no confirmation dialog appears and
`getByRole("button", { name: "Delete" })` is not found.

- [ ] **Step 4: Write the implementation**

In `apps/web/src/features/clients/ClientPage/ClientPage.tsx`, add the hook to the existing
import from the campaigns data layer:

```tsx
import { useCampaigns, useDeleteCampaign } from "../../campaigns/data/queries.js";
```

Add the mutation and one piece of state beside the others, and derive the sheet being
deleted next to `renamingSheet`:

```tsx
  const removeSheet = useDeleteCampaign(clientId ?? "");
  const [deletingSheetId, setDeletingSheetId] = useState<string | undefined>(undefined);

  const deletingSheet = campaigns.data?.find((campaign) => campaign.id === deletingSheetId);
```

Add the handler beside `onConfirmDelete`. It picks the neighbour *before* deleting, while
the list still contains the sheet:

```tsx
  async function onConfirmDeleteSheet() {
    const all = campaigns.data ?? [];
    const index = all.findIndex((campaign) => campaign.id === deletingSheetId);
    const neighbour = all[index - 1] ?? all[index + 1];
    await removeSheet.mutateAsync(deletingSheetId!);
    setDeletingSheetId(undefined);
    if (neighbour != null) navigate(`/clients/${clientId}/campaigns/${neighbour.id}`, { replace: true });
  }
```

Replace the temporary no-op from Task 3 on the `CampaignTabs` element:

```tsx
            onDelete={(id) => setDeletingSheetId(id)}
```

And render the confirmation beside the page's other dialogs:

```tsx
      {deletingSheet != null && (
        <Dialog open onClose={() => setDeletingSheetId(undefined)} title={t("campaigns.delete.title")}>
          <p>{t("campaigns.delete.body")}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setDeletingSheetId(undefined)}>
              {t("action.cancel")}
            </Button>
            <Button variant="danger" onClick={onConfirmDeleteSheet} disabled={removeSheet.isPending}>
              {t("action.delete")}
            </Button>
          </div>
        </Dialog>
      )}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/features/clients/ClientPage`
Expected: PASS — the existing tests plus the new one.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/clients/ClientPage apps/web/src/i18n/en.ts
git commit -m "feat(web): confirm sheet deletion and open the neighbouring sheet"
```

---

### Task 5: Day creation on the data layer

**Files:**
- Modify: `apps/web/src/features/campaigns/data/api.ts`, `apps/web/src/features/campaigns/data/queries.ts`, `apps/web/src/lib/format.ts`
- Test: `apps/web/src/features/campaigns/data/queries.test.tsx`, `apps/web/src/lib/format.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface RecordInput { date: string }                      // YYYY-MM-DD
  interface CampaignRecordSummary { id: string; campaignId: string; date: string }
  recordsApi.create(campaignId: string, body: RecordInput): Promise<CampaignRecordSummary>
  useCreateRecord(campaignId: string)                         // mutate takes RecordInput
  nextDay(iso: string): string                                // "2026-08-31" -> "2026-09-01"
  todayIso(): string                                          // local calendar day
  ```
  `useCreateRecord` invalidates `["campaigns", campaignId]`, the table query, so the new row and the recomputed totals arrive together.

**Context:** the server stores a day as a pure date and rejects a duplicate with 409, so
the caller picks a date that cannot collide. `nextDay` does UTC arithmetic to avoid a
daylight-saving shift moving the day; `todayIso` deliberately uses the *local* calendar
day, because "today" means the user's today.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/lib/format.test.ts`, extending its import from `./format.js` with
`nextDay` and `todayIso`:

```ts
describe("nextDay", () => {
  it("advances one calendar day", () => {
    expect(nextDay("2026-08-01")).toBe("2026-08-02");
  });

  it("rolls over months and years", () => {
    expect(nextDay("2026-08-31")).toBe("2026-09-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });
});

describe("todayIso", () => {
  it("returns the local calendar day as YYYY-MM-DD", () => {
    const now = new Date();
    const expected = [
      now.getFullYear(),
      `${now.getMonth() + 1}`.padStart(2, "0"),
      `${now.getDate()}`.padStart(2, "0"),
    ].join("-");

    expect(todayIso()).toBe(expected);
  });
});
```

Add to `apps/web/src/features/campaigns/data/queries.test.tsx`, extending its import from
`./queries.js` with `useCreateRecord`:

```tsx
describe("useCreateRecord", () => {
  it("posts a day to one campaign", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/campaigns/c1/records", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { id: "r1", campaignId: "c1", date: "2026-08-03" },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateRecord("c1"), { wrapper: hookWrapper() });
    const created = await result.current.mutateAsync({ date: "2026-08-03" });

    expect(received).toEqual({ date: "2026-08-03" });
    expect(created.date).toBe("2026-08-03");
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run --root apps/web src/lib/format.test.ts src/features/campaigns/data`
Expected: FAIL — `nextDay`, `todayIso` and `useCreateRecord` are not exported.

- [ ] **Step 3: Add the date helpers**

Append to `apps/web/src/lib/format.ts`:

```ts
/** "2026-08-31" -> "2026-09-01". UTC arithmetic, so no daylight-saving shift moves the day. */
export function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** The viewer's own calendar day — "today" is local, not UTC. */
export function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
```

- [ ] **Step 4: Add the endpoint wrapper and the hook**

In `apps/web/src/features/campaigns/data/api.ts`, add the types and a second exported
object below `campaignsApi`:

```ts
export interface RecordInput {
  date: string;
}

export interface CampaignRecordSummary {
  id: string;
  campaignId: string;
  date: string;
}

export const recordsApi = {
  create: (campaignId: string, body: RecordInput) =>
    http.post<CampaignRecordSummary>(`/campaigns/${campaignId}/records`, body),
};
```

In `apps/web/src/features/campaigns/data/queries.ts`, widen the import and append the hook:

```ts
import { campaignsApi, recordsApi, type CampaignInput, type RecordInput } from "./api.js";
```

```ts
export function useCreateRecord(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecordInput) => recordsApi.create(campaignId, body),
    // The table query carries the rows and the totals; both change when a day is added.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", campaignId] }),
  });
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run --root apps/web src/lib/format.test.ts src/features/campaigns/data`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/format.ts apps/web/src/lib/format.test.ts apps/web/src/features/campaigns/data
git commit -m "feat(web): add day creation and next-day helpers"
```

---

### Task 6: The sheet always renders its columns, under a header row

**Files:**
- Create: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.module.css`
- Modify: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx`, `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`

**Interfaces:**
- Consumes: `useCreateRecord`, `nextDay`, `todayIso` (Task 5).
- Produces: the finished sheet — a header row with the title and an add-day button, then the table, rendered whether or not the sheet has days.

**Context:** the sheet currently returns an empty state whenever it has no records, so a
freshly created sheet never shows the eleven default columns it was seeded with. That
early return goes away: an empty sheet renders its headers and a `TOTAL` row of dashes,
which is what makes it look like a sheet you can start filling. The two `sheet.empty.*`
copy keys become unused and are removed.

- [ ] **Step 1: Update the copy**

In `apps/web/src/i18n/en.ts`, **remove** these two keys:

```ts
  "sheet.empty.title": "No days yet",
  "sheet.empty.description": "This sheet has no records",
```

and add, beside the other `sheet.*` keys:

```ts
  "sheet.title": "Daily statistics",
  "sheet.addDay": "Add day",
```

- [ ] **Step 2: Write the failing tests**

In `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.test.tsx`,
replace the test named `"shows an empty state when the campaign has no records"` with the
two below, and add the third. The file already defines the `table` fixture and imports
`mock`, `HttpResponse`, `server`, `screen`, `within` and `renderWithProviders`; add
`userEvent` and `waitFor` to its imports:

```tsx
  it("renders the columns and the header even when the sheet has no days", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json({ ...table, records: [] })));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    expect(await screen.findByRole("columnheader", { name: "SPEND" })).toBeInTheDocument();
    expect(screen.getByText("Daily statistics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add day" })).toBeInTheDocument();
    // Header row and the TOTAL row, and no day rows between them.
    const body = screen.getAllByRole("rowgroup")[1];
    expect(within(body).queryAllByRole("row")).toHaveLength(0);
  });

  it("adds the day after the last row", async () => {
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.post("/api/campaigns/c1/records", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: "r9", campaignId: "c1", date: "2026-08-03" }, { status: 201 });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add day" }));

    // The fixture's last record is 2026-08-02.
    await waitFor(() => expect(received).toEqual({ date: "2026-08-03" }));
  });

  it("adds today when the sheet has no days", async () => {
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json({ ...table, records: [] })),
      mock.post("/api/campaigns/c1/records", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: "r9", campaignId: "c1", date: "2026-01-01" }, { status: 201 });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add day" }));

    const now = new Date();
    const today = [
      now.getFullYear(),
      `${now.getMonth() + 1}`.padStart(2, "0"),
      `${now.getDate()}`.padStart(2, "0"),
    ].join("-");
    await waitFor(() => expect(received).toEqual({ date: today }));
  });
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignSheet`
Expected: FAIL — the empty sheet still renders "No days yet" instead of a table, and there
is no add-day button.

- [ ] **Step 4: Write the stylesheet**

Create `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.module.css`:

```css
.sheet {
  margin-top: var(--space-6);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.title {
  font-size: 16px;
  font-weight: 700;
}
```

- [ ] **Step 5: Write the component**

In `apps/web/src/features/campaigns/components/CampaignSheet/CampaignSheet.tsx`, extend
the imports:

```tsx
import { formatDay, formatValue, nextDay, todayIso } from "../../../../lib/format.js";
import { useCampaignTable, useCreateRecord } from "../../data/queries.js";
import styles from "./CampaignSheet.module.css";
```

Call the mutation with the other hooks, above every early return — hooks cannot sit after
one:

```tsx
export function CampaignSheet({ campaignId }: CampaignSheetProps) {
  const table = useCampaignTable(campaignId);
  const addDay = useCreateRecord(campaignId);
```

Delete the `records.length === 0` early return entirely, then replace the final `return`
with the header plus the table:

```tsx
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
```

Leave the pending and error branches, `columns`, `rows` and `footer` exactly as they are.

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignSheet`
Expected: PASS — the table, dash, error and three new tests.

- [ ] **Step 7: Run everything**

Run: `npm run test:web && npx tsc --noEmit -p apps/web/tsconfig.json && npm test`
Expected: all three clean. Watch for any other test that asserted "No days yet" — the
`ClientPage` suite renders sheets with empty payloads and may have relied on it.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/campaigns/components/CampaignSheet apps/web/src/i18n/en.ts
git commit -m "feat(web): give the sheet a header row and always render its columns"
```

---

## Done when

- The active tab's underline spans its label and both icon buttons as one unit.
- A sheet can be deleted from the cross beside the pencil, after a confirmation naming what is lost; the control is absent when the client has one sheet; deleting the open sheet opens its neighbour.
- The add-sheet button keeps its width when the tabs overflow; the tab list scrolls instead.
- A newly created sheet immediately shows its eleven default columns and a `TOTAL` row.
- The table sits below a header row carrying "Daily statistics" on the left and "+ Add day" on the right, separated from the tab strip.
- "+ Add day" adds the day after the last row, or today on an empty sheet, and the table and totals refresh.
- `npm run test:web`, `npx tsc --noEmit -p apps/web/tsconfig.json` and `npm test` are all clean.
