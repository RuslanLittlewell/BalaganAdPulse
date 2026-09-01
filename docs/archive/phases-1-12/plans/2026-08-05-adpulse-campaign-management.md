# AdPulse Campaign Creation and Renaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a media buyer add and rename report sheets — every new client starts with a seeded `Main` sheet, a `+ New sheet` button adds more, and a pencil inside the active tab renames it.

**Architecture:** The backend seeds a default campaign inside the same `prisma.client.create` call, so "a client always has at least one sheet" is a property of the data rather than of the UI. On the frontend, `Tabs` gains two domain-free slots — a trailing action and a per-active-tab icon button — and a single `CampaignFormDialog` serves both create and rename, mirroring the existing `ClientFormDialog`.

**Tech Stack:** Express, Prisma, Zod, Vitest + Supertest (API); React 19, TypeScript, react-router-dom v6, @tanstack/react-query v5, CSS Modules + design tokens, Vitest + Testing Library + MSW (web).

**Spec:** none — this is a small increment on
[2026-08-03-adpulse-campaign-sheets-design.md](../specs/2026-08-03-adpulse-campaign-sheets-design.md),
which listed campaign creation and renaming as out of scope. That doc's constraints
still bind; this plan lifts only its read-only rule, and only for create and rename.

## Global Constraints

Shared conventions (English-only, Conventional Commits, TDD, testing setup, error
envelope) live in [conventions.md](../conventions.md). Phase-specific:

- **No utility-CSS framework, no component kit** — every component is hand-written as `Component.tsx` + `Component.module.css`. No icon library either: the pencil is an inline SVG.
- **`components/` may not import from `features/`** and may not name a domain concept. `Tabs` and `PencilIcon` must not mention campaigns or sheets.
- **Design tokens only** — components reference `var(--…)`; no literal colours, spacing or radii in component CSS.
- **UI copy** lives in `src/i18n/en.ts`, never inlined in JSX; read it through `t(key)`. `"Main"` is a backend constant, **not** UI copy — it never appears in `en.ts`.
- **Sheet vs Campaign** — the UI says "sheet", the domain says `Campaign`. Keep API types, hooks and services on `campaign`; keep user-visible copy on "sheet".
- **Delete stays unbuilt** — this plan adds create and rename only. `DELETE /api/campaigns/:id` exists on the server; no UI may call it, and no delete control is rendered, not even disabled. Reordering is likewise out.
- **Commits** — each task ends with a `Commit` step showing the exact command.

---

## File Structure

```
apps/api/src/
  campaigns/defaults.ts          + DEFAULT_CAMPAIGN_NAME, buildCampaignCreateData()   (Task 1)
  campaigns/campaign.service.ts  createCampaign uses the shared helper                (Task 1)
  clients/client.service.ts      createClient seeds the Main campaign                 (Task 1)

apps/web/src/
  features/campaigns/data/api.ts       + CampaignInput, campaignsApi.create/update    (Task 2)
  features/campaigns/data/queries.ts   + useCreateCampaign, useUpdateCampaign         (Task 2)
  components/PencilIcon/PencilIcon.tsx inline SVG, no library                         (Task 3)
  components/Tabs/Tabs.tsx             + action slot, + itemAction on the active tab  (Task 4)
  features/campaigns/components/CampaignFormDialog/   create + rename dialog          (Task 5)
  features/campaigns/components/CampaignTabs/         + onNew, onRename               (Task 6)
  features/clients/ClientPage/ClientPage.tsx          dialog state, empty-state button(Task 7)
  i18n/en.ts                                          new copy keys                   (Tasks 5-7)
```

**Why the seeding helper is extracted rather than duplicated:** `createCampaign` already
builds a campaign plus its eleven default properties. `createClient` now needs the same
shape nested inside its own create. Copying that block into the client service would be
two places to update whenever the default property set changes.

**Why `ClientPage` owns the dialog state:** it renders both entry points — the tab strip
when the client has sheets, and the empty state when it does not. Putting the state in
`CampaignTabs` would leave the empty state unable to open the same dialog. This matches
`ClientSidebar`, which owns its client dialog's state the same way.

---

### Task 1: Seed a `Main` campaign when a client is created

**Files:**
- Modify: `apps/api/src/campaigns/defaults.ts`, `apps/api/src/campaigns/campaign.service.ts`, `apps/api/src/clients/client.service.ts`
- Test: `apps/api/test/clients/client.service.test.ts`, `apps/api/test/clients/client.api.test.ts`

**Interfaces:**
- Produces: `DEFAULT_CAMPAIGN_NAME = "Main"` and `buildCampaignCreateData(name: string, position: number)` from `campaigns/defaults.js`. The returned object has no `clientId` — the caller supplies it, either alongside (campaign service) or implicitly through a nested create (client service).

**Context:** API tests need Postgres (`docker compose up -d db`) and use the separate
`adpulse_test` database. Run them from the repository root with `npm test`.

- [ ] **Step 1: Write the failing service test**

Add to `apps/api/test/clients/client.service.test.ts`, inside the existing
`describe("client.service")`:

```ts
  it("seeds a Main campaign with the default properties", async () => {
    const client = await createClient({ name: "Acme" });

    const campaigns = await prisma.campaign.findMany({ where: { clientId: client.id } });
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].name).toBe("Main");
    expect(campaigns[0].position).toBe(0);

    const properties = await prisma.campaignProperty.findMany({
      where: { campaignId: campaigns[0].id }, orderBy: { position: "asc" },
    });
    expect(properties).toHaveLength(11);
    expect(properties.map((property) => property.key)).toEqual([
      "spend", "impressions", "clicks", "ctr", "cpm", "cpc",
      "leads", "cpl", "revenue", "roas", "comment",
    ]);
  });
```

- [ ] **Step 2: Write the failing API test**

Add to `apps/api/test/clients/client.api.test.ts`, inside its existing `describe`:

```ts
  it("POST /api/clients seeds one Main campaign", async () => {
    const created = await request(app).post("/api/clients").send({ name: "Acme" });
    const res = await request(app).get(`/api/clients/${created.body.id}/campaigns`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Main");
  });
```

- [ ] **Step 3: Run both tests and watch them fail**

Run: `npx vitest run --root apps/api test/clients`
Expected: FAIL — the service test finds 0 campaigns; the API test gets an empty array.

- [ ] **Step 4: Extract the shared seeding helper**

In `apps/api/src/campaigns/defaults.ts`, add this import at the top:

```ts
import { toJson } from "../formula/expression.schema.js";
```

and append at the end of the file:

```ts
/** The sheet every client starts with. Not UI copy — the client names it. */
export const DEFAULT_CAMPAIGN_NAME = "Main";

/**
 * Prisma create input for a campaign and its default properties, without `clientId`.
 * The campaign service supplies it explicitly; the client service nests this under
 * its own create, where Prisma fills it in.
 */
export function buildCampaignCreateData(name: string, position: number) {
  return {
    name,
    position,
    properties: {
      create: buildDefaultProperties().map((property) => ({
        id: property.id,
        key: property.key,
        name: property.name,
        type: property.type,
        position: property.position,
        formula: toJson(property.formula),
      })),
    },
  };
}
```

- [ ] **Step 5: Use the helper in the campaign service**

In `apps/api/src/campaigns/campaign.service.ts`, replace the body of `createCampaign`'s
`prisma.campaign.create` call so it reads:

```ts
export async function createCampaign(
  clientId: string,
  input: { name: string },
): Promise<Campaign> {
  await assertClientExists(clientId);
  const position = await prisma.campaign.count({ where: { clientId } });
  return prisma.campaign.create({
    data: { clientId, ...buildCampaignCreateData(input.name, position) },
  });
}
```

Update its import from `./defaults.js` to bring in the helper:

```ts
import { buildCampaignCreateData } from "./defaults.js";
```

Remove the now-unused `buildDefaultProperties` and `toJson` imports **only if** nothing
else in the file uses them — check before deleting.

- [ ] **Step 6: Seed the campaign in the client service**

In `apps/api/src/clients/client.service.ts`, add the import:

```ts
import { buildCampaignCreateData, DEFAULT_CAMPAIGN_NAME } from "../campaigns/defaults.js";
```

and replace `createClient`:

```ts
export async function createClient(input: CreateClientInput): Promise<Client> {
  return prisma.client.create({
    data: {
      ...input,
      campaigns: { create: buildCampaignCreateData(DEFAULT_CAMPAIGN_NAME, 0) },
    },
  });
}
```

A single nested `create` is one statement, so the client and its sheet are committed
together — no partially-seeded client is possible. The return type is unchanged: the
client payload gains no fields.

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npx vitest run --root apps/api test/clients`
Expected: PASS — the existing client tests plus the two new ones.

- [ ] **Step 8: Run the whole API suite**

Run: `npm test`
Expected: PASS. Every existing test must stay green. Pay attention to any test that
creates a client through `createClient` or `POST /api/clients` and then counts
campaigns — such a test would now see one where it expected none. If one fails, fix the
test's expectation (the new seeding is the intended behaviour), not the seeding.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/campaigns/defaults.ts apps/api/src/campaigns/campaign.service.ts \
        apps/api/src/clients/client.service.ts apps/api/test/clients
git commit -m "feat(api): seed a Main campaign when a client is created"
```

---

### Task 2: Campaign create and update on the frontend data layer

**Files:**
- Modify: `apps/web/src/features/campaigns/data/api.ts`, `apps/web/src/features/campaigns/data/queries.ts`
- Test: `apps/web/src/features/campaigns/data/queries.test.tsx`

**Interfaces:**
- Consumes: the existing `campaignsApi` object and `CampaignSummary` type in `data/api.ts`.
- Produces:
  ```ts
  interface CampaignInput { name: string }
  campaignsApi.create(clientId: string, body: CampaignInput): Promise<CampaignSummary>
  campaignsApi.update(campaignId: string, body: CampaignInput): Promise<CampaignSummary>
  useCreateCampaign(clientId: string)   // mutate({ name })
  useUpdateCampaign(clientId: string)   // mutate({ id, body })
  ```
  Both hooks invalidate `["clients", clientId, "campaigns"]`; `useUpdateCampaign` also invalidates `["campaigns", id]` so the open sheet picks up its new name.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/features/campaigns/data/queries.test.tsx`. It already imports
`mock`, `HttpResponse`, `server`, `hookWrapper`, `renderHook` and `waitFor`; add
`useCreateCampaign` and `useUpdateCampaign` to its import from `./queries.js`.

```tsx
describe("useCreateCampaign", () => {
  it("posts the name and returns the created campaign", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/clients/1/campaigns", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { id: "c9", clientId: "1", name: "Display", position: 1, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateCampaign("1"), { wrapper: hookWrapper() });
    const created = await result.current.mutateAsync({ name: "Display" });

    expect(received).toEqual({ name: "Display" });
    expect(created.id).toBe("c9");
  });
});

describe("useUpdateCampaign", () => {
  it("patches the name of one campaign", async () => {
    let method = "";
    let received: unknown;
    server.use(
      mock.patch("/api/campaigns/c1", async ({ request }) => {
        method = request.method;
        received = await request.json();
        return HttpResponse.json(
          { id: "c1", clientId: "1", name: "Renamed", position: 0, createdAt: "", updatedAt: "" },
        );
      }),
    );

    const { result } = renderHook(() => useUpdateCampaign("1"), { wrapper: hookWrapper() });
    const updated = await result.current.mutateAsync({ id: "c1", body: { name: "Renamed" } });

    expect(method).toBe("PATCH");
    expect(received).toEqual({ name: "Renamed" });
    expect(updated.name).toBe("Renamed");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/features/campaigns/data`
Expected: FAIL — `useCreateCampaign` and `useUpdateCampaign` are not exported.

- [ ] **Step 3: Add the endpoint wrappers**

In `apps/web/src/features/campaigns/data/api.ts`, add the input type above the
`campaignsApi` object:

```ts
export interface CampaignInput {
  name: string;
}
```

and extend the object — keep the existing `list` and `get` untouched:

```ts
export const campaignsApi = {
  list: (clientId: string) => http.get<CampaignSummary[]>(`/clients/${clientId}/campaigns`),
  get: (campaignId: string) => http.get<CampaignTable>(`/campaigns/${campaignId}`),
  create: (clientId: string, body: CampaignInput) =>
    http.post<CampaignSummary>(`/clients/${clientId}/campaigns`, body),
  update: (campaignId: string, body: CampaignInput) =>
    http.patch<CampaignSummary>(`/campaigns/${campaignId}`, body),
};
```

- [ ] **Step 4: Add the mutation hooks**

In `apps/web/src/features/campaigns/data/queries.ts`, widen the import and append the
hooks:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { campaignsApi, type CampaignInput } from "./api.js";
```

```ts
export function useCreateCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CampaignInput) => campaignsApi.create(clientId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", clientId, "campaigns"] }),
  });
}

export function useUpdateCampaign(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CampaignInput }) =>
      campaignsApi.update(id, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["clients", clientId, "campaigns"] });
      // the open sheet carries the campaign name too
      qc.invalidateQueries({ queryKey: ["campaigns", variables.id] });
    },
  });
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/features/campaigns/data`
Expected: PASS — the existing query tests plus the two new ones.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/campaigns/data
git commit -m "feat(web): add campaign create and rename mutations"
```

---

### Task 3: `PencilIcon`

**Files:**
- Create: `apps/web/src/components/PencilIcon/PencilIcon.tsx`
- Test: `apps/web/src/components/PencilIcon/PencilIcon.test.tsx`

**Interfaces:**
- Produces: `<PencilIcon />` — a 14×14 inline SVG that inherits its colour from the parent's `color` via `stroke="currentColor"`, and is `aria-hidden` because the button around it carries the accessible name.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/PencilIcon/PencilIcon.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { PencilIcon } from "./PencilIcon.js";

describe("PencilIcon", () => {
  it("renders a decorative svg that inherits the text colour", () => {
    const { container } = render(<PencilIcon />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/components/PencilIcon`
Expected: FAIL — `Failed to resolve import "./PencilIcon.js"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/PencilIcon/PencilIcon.tsx`:

```tsx
/** Decorative — the button that wraps it carries the accessible name. */
export function PencilIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
```

No CSS module: the icon has no styling of its own, taking colour and size from the
button around it.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/components/PencilIcon`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PencilIcon
git commit -m "feat(web): add PencilIcon"
```

---

### Task 4: `Tabs` gains an action slot and a per-tab icon button

**Files:**
- Modify: `apps/web/src/components/Tabs/Tabs.tsx`, `apps/web/src/components/Tabs/Tabs.module.css`
- Test: `apps/web/src/components/Tabs/Tabs.test.tsx`

**Interfaces:**
- Produces, in addition to the existing `items` / `activeId` / `onSelect`:
  ```ts
  interface TabItemAction { icon: ReactNode; label: string; onSelect: (id: string) => void }
  action?: ReactNode        // trailing, rendered OUTSIDE the tablist
  itemAction?: TabItemAction // rendered inside the ACTIVE tab only
  ```
  Existing call sites pass neither and must keep working unchanged.

**Two structural rules this task must respect:**
- The trailing `action` cannot live inside the `role="tablist"` element — a button there is announced as a tab. It renders as a sibling of the tablist inside a wrapping strip.
- The icon button cannot be nested inside the tab `<button>` — a button inside a button is invalid HTML. Each item becomes a `role="presentation"` wrapper holding the tab button and, when active, the icon button beside it.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe("Tabs")` in `apps/web/src/components/Tabs/Tabs.test.tsx`.
The file already defines `items` and imports `render`, `screen`, `userEvent` and `Tabs`:

```tsx
  it("renders a trailing action that is not a tab", async () => {
    const onNew = vi.fn();
    render(
      <Tabs
        items={items}
        activeId="a"
        onSelect={() => {}}
        action={<button type="button" onClick={onNew}>+ New</button>}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    const add = screen.getByRole("button", { name: "+ New" });
    expect(add).not.toHaveAttribute("role");

    await userEvent.click(add);
    expect(onNew).toHaveBeenCalled();
  });

  it("renders the item action on the active tab only, and reports its id", async () => {
    const onEdit = vi.fn();
    render(
      <Tabs
        items={items}
        activeId="b"
        onSelect={() => {}}
        itemAction={{ icon: <span>pencil</span>, label: "Rename", onSelect: onEdit }}
      />,
    );

    const edit = screen.getByRole("button", { name: "Rename" });
    expect(screen.getAllByRole("button", { name: "Rename" })).toHaveLength(1);

    await userEvent.click(edit);
    expect(onEdit).toHaveBeenCalledWith("b");
  });

  it("renders no item action when none is given", () => {
    render(<Tabs items={items} activeId="a" onSelect={() => {}} />);

    // The tabs carry role="tab", so nothing should match the plain button role.
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run --root apps/web src/components/Tabs`
Expected: FAIL — TypeScript rejects the unknown `action` and `itemAction` props, and
neither button is found. The three pre-existing `Tabs` tests still pass.

- [ ] **Step 3: Write the implementation**

Replace `apps/web/src/components/Tabs/Tabs.tsx` with:

```tsx
import type { ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: string;
}

/** An icon button shown inside the active tab. The caller owns the icon and its name. */
export interface TabItemAction {
  icon: ReactNode;
  label: string;
  onSelect: (id: string) => void;
}

export interface TabsProps {
  items: TabItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  action?: ReactNode;
  itemAction?: TabItemAction;
}

export function Tabs({ items, activeId, onSelect, action, itemAction }: TabsProps) {
  return (
    <div className={styles.strip}>
      <div className={styles.tabs} role="tablist">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            // A plain wrapper so the icon button is a sibling of the tab, not nested
            // inside it; `presentation` keeps it out of the tablist's child semantics.
            <div key={item.id} className={styles.item} role="presentation">
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
              {active && itemAction != null && (
                <button
                  type="button"
                  className={styles.itemAction}
                  aria-label={itemAction.label}
                  onClick={() => itemAction.onSelect(item.id)}
                >
                  {itemAction.icon}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {action != null && <div className={styles.action}>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Update the stylesheet**

Replace `apps/web/src/components/Tabs/Tabs.module.css` with:

```css
.strip {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.tabs {
  display: flex;
  gap: var(--space-1);
  overflow-x: auto;
}

.item {
  display: inline-flex;
  align-items: center;
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

.itemAction {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
}

.itemAction:hover {
  color: var(--color-text);
}
```

The `border-bottom` moves from `.tabs` to `.strip` so the trailing action sits on the
same rule rather than beside it.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run --root apps/web src/components/Tabs`
Expected: PASS — the three pre-existing tests plus the three new ones.

- [ ] **Step 6: Check the existing consumer still renders**

Run: `npx vitest run --root apps/web src/features/campaigns src/features/clients`
Expected: PASS — `CampaignTabs` passes neither new prop and must be unaffected.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/Tabs
git commit -m "feat(web): add action and per-tab icon slots to Tabs"
```

---

### Task 5: `CampaignFormDialog`

**Files:**
- Create: `apps/web/src/features/campaigns/components/CampaignFormDialog/CampaignFormDialog.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/campaigns/components/CampaignFormDialog/CampaignFormDialog.test.tsx`

**Interfaces:**
- Consumes: `useCreateCampaign(clientId)`, `useUpdateCampaign(clientId)` and `CampaignSummary` (Task 2); the existing `Dialog`, `TextField`, `Button` components and `ApiError` from `lib/http.js`.
- Produces: `<CampaignFormDialog clientId={string} campaign?={CampaignSummary} onClose={() => void} onCreated?={(campaign: CampaignSummary) => void} />`. Passing `campaign` switches it to rename mode, exactly as `campaign`'s absence means create — the same shape `ClientFormDialog` uses with its `client` prop.

**Context:** read `apps/web/src/features/clients/components/ClientFormDialog/ClientFormDialog.tsx`
first. This is the same component with one field instead of four; follow its structure
for the error mapping and the submit handler.

- [ ] **Step 1: Add the copy keys**

In `apps/web/src/i18n/en.ts`, add after the existing `campaigns.empty.description` entry:

```ts
  "campaigns.new": "New sheet",
  "campaigns.rename": "Rename sheet",
  "campaigns.form.new.title": "New sheet",
  "campaigns.form.edit.title": "Rename sheet",
```

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/features/campaigns/components/CampaignFormDialog/CampaignFormDialog.test.tsx`:

```tsx
import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../../../../test/server.js";
import { renderWithProviders } from "../../../../test/utils.js";
import { CampaignFormDialog } from "./CampaignFormDialog.js";

const campaign = {
  id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "",
};

describe("CampaignFormDialog", () => {
  it("creates a sheet and reports the created campaign", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/clients/1/campaigns", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ ...campaign, id: "c9", name: "Display" }, { status: 201 });
      }),
    );
    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <CampaignFormDialog clientId="1" onClose={onClose} onCreated={onCreated} />,
    );

    await userEvent.type(screen.getByLabelText("Name"), "  Display  ");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(received).toEqual({ name: "Display" });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "c9" }));
  });

  it("disables Create until a name is entered", async () => {
    renderWithProviders(<CampaignFormDialog clientId="1" onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name"), "Display");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("prefills the name in rename mode and saves with PATCH", async () => {
    let method = "";
    server.use(
      mock.patch("/api/campaigns/c1", async ({ request }) => {
        method = request.method;
        return HttpResponse.json({ ...campaign, name: "Renamed" });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(
      <CampaignFormDialog clientId="1" campaign={campaign} onClose={onClose} />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Search ads");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(method).toBe("PATCH");
  });

  it("shows a field error from a 400 response", async () => {
    server.use(
      mock.post("/api/clients/1/campaigns", () =>
        HttpResponse.json(
          { error: { message: "Validation error", details: [{ path: ["name"], message: "name is required" }] } },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<CampaignFormDialog clientId="1" onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("name is required")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignFormDialog`
Expected: FAIL — `Failed to resolve import "./CampaignFormDialog.js"`.

- [ ] **Step 4: Write the implementation**

Create `apps/web/src/features/campaigns/components/CampaignFormDialog/CampaignFormDialog.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { Dialog } from "../../../../components/Dialog/Dialog.js";
import { TextField } from "../../../../components/TextField/TextField.js";
import { Button } from "../../../../components/Button/Button.js";
import { ApiError } from "../../../../lib/http.js";
import { t } from "../../../../i18n/en.js";
import { useCreateCampaign, useUpdateCampaign } from "../../data/queries.js";
import type { CampaignSummary } from "../../data/api.js";

export interface CampaignFormDialogProps {
  clientId: string;
  campaign?: CampaignSummary;
  onClose: () => void;
  onCreated?: (campaign: CampaignSummary) => void;
}

/** Pulls the server's message for the `name` field out of a 400 envelope. */
function nameError(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  for (const issue of error.details) {
    const path = (issue as { path?: unknown[] }).path;
    const message = (issue as { message?: string }).message;
    if (Array.isArray(path) && path[0] === "name" && message) return message;
  }
  return undefined;
}

export function CampaignFormDialog({
  clientId, campaign, onClose, onCreated,
}: CampaignFormDialogProps) {
  const isEdit = campaign != null;
  const [name, setName] = useState(campaign?.name ?? "");
  const [error, setError] = useState<string | undefined>(undefined);
  const create = useCreateCampaign(clientId);
  const update = useUpdateCampaign(clientId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const body = { name: name.trim() };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: campaign.id, body });
      } else {
        // Kept on its own line: `onCreated?.(await …)` would short-circuit and
        // never create the sheet when no `onCreated` is supplied.
        const created = await create.mutateAsync(body);
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setError(nameError(err));
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(isEdit ? "campaigns.form.edit.title" : "campaigns.form.new.title")}
    >
      <form
        noValidate
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
      >
        <TextField
          label={t("form.name.label")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
          <Button variant="ghost" type="button" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={pending || name.trim() === ""}>
            {t(isEdit ? "action.save" : "action.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignFormDialog`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/campaigns/components/CampaignFormDialog apps/web/src/i18n/en.ts
git commit -m "feat(web): add the sheet create and rename dialog"
```

---

### Task 6: `CampaignTabs` renders the add and rename controls

**Files:**
- Modify: `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.tsx`
- Test: `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.test.tsx`

**Interfaces:**
- Consumes: `Tabs` with its new `action` and `itemAction` props, and `TabItemAction` (Task 4); `PencilIcon` (Task 3).
- Produces: `<CampaignTabs clientId campaigns activeCampaignId onNew={() => void} onRename={(campaignId: string) => void} />`. Both callbacks are required — `ClientPage` owns the dialog state and always supplies them.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe("CampaignTabs")` in
`apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.test.tsx`. Its
two existing tests render `<CampaignTabs clientId="1" campaigns={campaigns} … />`;
update those calls to also pass `onNew={() => {}} onRename={() => {}}`, then add:

```tsx
  it("calls onNew from the add button", async () => {
    const onNew = vi.fn();
    renderWithProviders(
      <CampaignTabs
        clientId="1"
        campaigns={campaigns}
        activeCampaignId="c1"
        onNew={onNew}
        onRename={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "+ New sheet" }));

    expect(onNew).toHaveBeenCalled();
  });

  it("calls onRename with the active campaign id", async () => {
    const onRename = vi.fn();
    renderWithProviders(
      <CampaignTabs
        clientId="1"
        campaigns={campaigns}
        activeCampaignId="c2"
        onNew={() => {}}
        onRename={onRename}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Rename sheet" }));

    expect(onRename).toHaveBeenCalledWith("c2");
  });
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignTabs`
Expected: FAIL — TypeScript rejects the unknown `onNew`/`onRename` props, and neither
button is found.

- [ ] **Step 3: Write the implementation**

Replace `apps/web/src/features/campaigns/components/CampaignTabs/CampaignTabs.tsx` with:

```tsx
import { useNavigate } from "react-router-dom";
import { Tabs } from "../../../../components/Tabs/Tabs.js";
import { Button } from "../../../../components/Button/Button.js";
import { PencilIcon } from "../../../../components/PencilIcon/PencilIcon.js";
import { t } from "../../../../i18n/en.js";
import type { CampaignSummary } from "../../data/api.js";

export interface CampaignTabsProps {
  clientId: string;
  campaigns: CampaignSummary[];
  activeCampaignId?: string;
  onNew: () => void;
  onRename: (campaignId: string) => void;
}

export function CampaignTabs({
  clientId, campaigns, activeCampaignId, onNew, onRename,
}: CampaignTabsProps) {
  const navigate = useNavigate();

  return (
    <Tabs
      items={campaigns.map((campaign) => ({ id: campaign.id, label: campaign.name }))}
      activeId={activeCampaignId}
      onSelect={(campaignId) => navigate(`/clients/${clientId}/campaigns/${campaignId}`)}
      itemAction={{ icon: <PencilIcon />, label: t("campaigns.rename"), onSelect: onRename }}
      action={
        <Button variant="ghost" size="sm" onClick={onNew}>
          + {t("campaigns.new")}
        </Button>
      }
    />
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run --root apps/web src/features/campaigns/components/CampaignTabs`
Expected: PASS — the two updated tests plus the two new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/campaigns/components/CampaignTabs
git commit -m "feat(web): add sheet add and rename controls to the tab strip"
```

---

### Task 7: Wire the dialog into `ClientPage`

**Files:**
- Modify: `apps/web/src/features/clients/ClientPage/ClientPage.tsx`, `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/features/clients/ClientPage/ClientPage.test.tsx`

**Interfaces:**
- Consumes: `CampaignFormDialog` (Task 5), `CampaignTabs` with `onNew`/`onRename` (Task 6), `EmptyState`'s existing `action` slot.
- Produces: the finished feature — the tab strip's `+ New sheet` and pencil both open the dialog, and the "no sheets yet" empty state offers the same create flow.

**Context:** the empty state is only reachable for clients created before Task 1 started
seeding a `Main` sheet. It stays because those clients exist; its button opens the same
dialog, where the user types the name.

- [ ] **Step 1: Add the copy key**

In `apps/web/src/i18n/en.ts`, add after the `campaigns.form.edit.title` entry:

```ts
  "campaigns.empty.action": "Create a sheet",
```

- [ ] **Step 2: Write the failing tests**

Add to the existing `describe("ClientPage")` in
`apps/web/src/features/clients/ClientPage/ClientPage.test.tsx`. The file already has a
`setup(route)` helper, a shared `client` fixture, and imports `mock`, `HttpResponse`,
`server`, `screen`, `waitFor` and `userEvent`:

```tsx
  it("creates a sheet from the empty state and opens it", async () => {
    const created = {
      id: "c9", clientId: "1", name: "Main", position: 0, createdAt: "", updatedAt: "",
    };
    let listed: unknown[] = [];
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () => HttpResponse.json(listed)),
      mock.post("/api/clients/1/campaigns", () => {
        listed = [created];
        return HttpResponse.json(created, { status: 201 });
      }),
      mock.get("/api/campaigns/c9", () =>
        HttpResponse.json({ ...created, properties: [], records: [], totals: {} }),
      ),
    );

    setup("/clients/1");

    await userEvent.click(await screen.findByRole("button", { name: "Create a sheet" }));
    await userEvent.type(screen.getByLabelText("Name"), "Main");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("tab", { name: "Main" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the rename dialog prefilled from the pencil", async () => {
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

    await userEvent.click(await screen.findByRole("button", { name: "Rename sheet" }));

    expect(screen.getByLabelText("Name")).toHaveValue("Search ads");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run --root apps/web src/features/clients/ClientPage`
Expected: FAIL — neither "Create a sheet" nor "Rename sheet" exists yet.

- [ ] **Step 4: Write the implementation**

In `apps/web/src/features/clients/ClientPage/ClientPage.tsx`, add the import:

```tsx
import { CampaignFormDialog } from "../../campaigns/components/CampaignFormDialog/CampaignFormDialog.js";
```

Add two pieces of state beside the existing `editing` and `confirming` — one flag for
the create dialog, one holding the id being renamed:

```tsx
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [renamingSheetId, setRenamingSheetId] = useState<string | undefined>(undefined);
```

Give the empty state its action, and pass the two callbacks to `CampaignTabs`:

```tsx
      {campaigns.isSuccess && campaigns.data.length === 0 && (
        <EmptyState
          title={t("campaigns.empty.title")}
          description={t("campaigns.empty.description")}
          action={
            <Button variant="primary" size="sm" onClick={() => setCreatingSheet(true)}>
              {t("campaigns.empty.action")}
            </Button>
          }
        />
      )}

      {campaigns.isSuccess && campaigns.data.length > 0 && (
        <>
          <CampaignTabs
            clientId={client.id}
            campaigns={campaigns.data}
            activeCampaignId={campaignId}
            onNew={() => setCreatingSheet(true)}
            onRename={(id) => setRenamingSheetId(id)}
          />
          {campaignId != null && <CampaignSheet campaignId={campaignId} />}
        </>
      )}
```

Render the dialog beside the two existing ones, at the end of the fragment. The renamed
campaign is looked up from the list the page already holds, so no extra request is made:

```tsx
      {creatingSheet && (
        <CampaignFormDialog
          clientId={client.id}
          onClose={() => setCreatingSheet(false)}
          onCreated={(campaign) => navigate(`/clients/${client.id}/campaigns/${campaign.id}`)}
        />
      )}

      {renamingSheetId != null && (
        <CampaignFormDialog
          clientId={client.id}
          campaign={campaigns.data?.find((campaign) => campaign.id === renamingSheetId)}
          onClose={() => setRenamingSheetId(undefined)}
        />
      )}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run --root apps/web src/features/clients/ClientPage`
Expected: PASS — the existing tests plus the two new ones.

- [ ] **Step 6: Run everything**

Run: `npm run test:web && npx tsc --noEmit -p apps/web/tsconfig.json && npm test`
Expected: all three clean — the web suite, the typechecker, and the API suite.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/clients/ClientPage apps/web/src/i18n/en.ts
git commit -m "feat(web): create and rename sheets from the client page"
```

---

## Done when

- Creating a client seeds one campaign named `Main` with the eleven default properties, in the same statement that creates the client.
- The tab strip shows `+ New sheet`; it opens a dialog with a name field and switches to the created sheet.
- The active tab shows a transparent pencil button whose icon brightens on hover; it opens the same dialog prefilled, and saving renames the tab.
- A client with no sheets offers `Create a sheet`, which opens the same dialog for a user-entered name.
- No delete or reorder control exists anywhere in the UI.
- `npm run test:web`, `npx tsc --noEmit -p apps/web/tsconfig.json` and `npm test` are all clean.
