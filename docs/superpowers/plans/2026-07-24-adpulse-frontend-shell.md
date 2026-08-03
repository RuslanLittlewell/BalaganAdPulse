# AdPulse Frontend Shell + Clients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `apps/web` frontend shell — a fixed client sidebar, a create/edit/delete client dialog, and an empty main area — assembled from a hand-written reusable component library.

**Architecture:** A new Vite + React + TypeScript workspace joins the npm monorepo. A `components/` layer holds domain-free, props-only UI written in CSS Modules; a `features/clients/` layer composes those into the client sidebar and form and talks to the existing REST API through TanStack Query. Selection lives in the URL via react-router.

**Tech Stack:** Vite, React 19, TypeScript, react-router-dom v6, @tanstack/react-query v5, CSS Modules + CSS custom properties, Vitest + jsdom + Testing Library + MSW.

**Spec:** [docs/superpowers/specs/2026-07-24-adpulse-frontend-shell-design.md](../specs/2026-07-24-adpulse-frontend-shell-design.md)

## Global Constraints

Shared conventions (English-only, Conventional Commits, TDD, testing setup, error
envelope) live in [conventions.md](../conventions.md). Phase-specific:

- **No utility-CSS framework, no component kit** — every component is hand-written as `Component.tsx` + `Component.module.css`. No Tailwind, shadcn, MUI or similar.
- **`components/` may not import from `features/`** and may not name a domain concept (e.g. "client"). Enforced by review.
- **Design tokens only** — components reference `var(--…)`; no literal colours, spacing, or radii in component CSS.
- **UI copy** lives in `src/i18n/en.ts`, never inlined in JSX; read it through `t(key)`.
- **Commits** — per project convention the user makes commits. Each task ends with a `Commit` step showing the exact command; when executing, surface it for the user to run rather than committing autonomously unless the user says otherwise.
- **`monthlyBudget` is asymmetric** — the API accepts it as a JSON number on create/update but returns it as a string. The form converts a non-empty entry to a number for the request body, omits the key when blank, and reads the string directly when prefilling.

---

## File Structure

> Delivered layout groups the feature into layers: `features/clients/data/`
> (`api.ts`, `queries.ts`), `features/clients/components/<Name>/` (one folder per UI
> component), and `features/clients/ClientPage/`. The flat listing below is the
> original plan.

```
apps/web/
  package.json                 @adpulse/web workspace
  index.html                   Vite entry HTML
  vite.config.ts               React plugin, /api proxy, Vitest config
  tsconfig.json                DOM + react-jsx
  src/
    main.tsx                   React root
    App.tsx                    providers + router
    i18n/en.ts                 copy dictionary + t()
    lib/
      http.ts                  fetch wrapper + ApiError
      queryClient.ts           shared QueryClient factory
    styles/
      tokens.css               design tokens on :root
      reset.css                minimal reset
    components/
      Button/                  Button.tsx + .module.css
      Avatar/
      SectionLabel/
      ListItem/
      EmptyState/
      TextField/
      Dialog/
      Sidebar/
      AppShell/
    features/clients/
      api.ts                   Client type + REST calls
      queries.ts               useClients/useCreateClient/useUpdateClient/useDeleteClient
      BrandHeader.tsx          wordmark for the sidebar top
      ClientSidebar.tsx        list + states + selection + new-client button
      ClientFormDialog.tsx     create/edit form in a Dialog
      ClientHeader.tsx         selected-client header with Edit/Delete
      ClientPage.tsx           /clients/:id route body
    routes/
      EmptyRoute.tsx           index route empty state
    test/
      setup.ts                 jest-dom, dialog polyfill, MSW lifecycle
      server.ts                MSW server
      handlers.ts              default /api/clients handlers
      utils.tsx                renderWithProviders, hookWrapper
```

---

### Task 1: Scaffold the `apps/web` workspace and test harness

**Files:**
- Create: `apps/web/package.json`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles/tokens.css`, `apps/web/src/styles/reset.css`, `apps/web/src/test/setup.ts`, `apps/web/src/smoke.test.ts`
- Modify: `package.json` (root, add web scripts)

**Interfaces:**
- Produces: the `@adpulse/web` workspace; `npm run test:web` and `npm run dev:web` from the repo root; `src/styles/tokens.css` custom properties; a jsdom+jest-dom test environment with an `HTMLDialogElement` polyfill.

- [ ] **Step 1: Create the workspace manifest**

Create `apps/web/package.json`:

```json
{
  "name": "@adpulse/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.62.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "msw": "^2.7.0",
    "typescript": "^5.7.2",
    "vite": "^6.0.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create the Vite + Vitest config**

Create `apps/web/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
```

- [ ] **Step 3: Create the TypeScript config**

Create `apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Create the HTML entry and React root**

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AdPulse</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/reset.css";
import "./styles/tokens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `apps/web/src/App.tsx` (placeholder, replaced in Task 13):

```tsx
export function App() {
  return <div>AdPulse</div>;
}
```

- [ ] **Step 5: Create the design tokens and reset**

Create `apps/web/src/styles/tokens.css`:

```css
:root {
  --color-bg: #111112;
  --color-surface: #1a1a1c;
  --color-border: #262628;
  --color-accent: #e8703a;
  --color-accent-contrast: #ffffff;
  --color-danger: #f2555a;
  --color-text: #f5f5f5;
  --color-text-muted: #8a8a8e;

  --color-avatar-1: #e8703a;
  --color-avatar-2: #4a8fe7;
  --color-avatar-3: #46b58a;
  --color-avatar-4: #b968d9;
  --color-avatar-5: #d9a441;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-sm: 8px;
  --radius-md: 12px;

  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;

  --sidebar-width: 280px;
}
```

Create `apps/web/src/styles/reset.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#root {
  height: 100%;
}

body {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
}

button {
  font: inherit;
  cursor: pointer;
}

input {
  font: inherit;
}
```

- [ ] **Step 6: Create the test setup**

Create `apps/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";

// jsdom does not implement the native <dialog> methods; provide the minimum
// our Dialog component relies on so component tests can run.
if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
}
```

- [ ] **Step 7: Write the smoke test**

Create `apps/web/src/smoke.test.ts`:

```ts
describe("web workspace", () => {
  it("runs vitest with jsdom", () => {
    expect(typeof window).toBe("object");
    expect(document.createElement("dialog").showModal).toBeTypeOf("function");
  });
});
```

- [ ] **Step 8: Add root scripts**

Modify the root `package.json` `scripts` block to add:

```json
    "dev:web": "npm run dev -w @adpulse/web",
    "build:web": "npm run build -w @adpulse/web",
    "test:web": "npm run test -w @adpulse/web"
```

- [ ] **Step 9: Install and run the smoke test**

Run: `npm install`
Then: `npm run test:web`
Expected: PASS, 1 test file, 1 test passing.

- [ ] **Step 10: Commit**

```bash
git add apps/web package.json package-lock.json
git commit -m "feat(web): scaffold web workspace with vite and vitest"
```

---

### Task 2: HTTP client and `ApiError`

**Files:**
- Create: `apps/web/src/lib/http.ts`, `apps/web/src/test/server.ts`, `apps/web/src/test/handlers.ts`, `apps/web/src/lib/http.test.ts`
- Modify: `apps/web/src/test/setup.ts` (wire MSW lifecycle)

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number; details: unknown[] }`
  - `const http: { get<T>(path): Promise<T>; post<T>(path, body): Promise<T>; patch<T>(path, body): Promise<T>; del(path): Promise<void> }`
  - `export const server` (MSW `setupServer`) and default handlers for reuse in later tasks.

- [ ] **Step 1: Create the MSW server and default handlers**

Create `apps/web/src/test/handlers.ts`:

```ts
import { http, HttpResponse } from "msw";

export const defaultHandlers = [
  http.get("/api/clients", () => HttpResponse.json([])),
];
```

Create `apps/web/src/test/server.ts`:

```ts
import { setupServer } from "msw/node";
import { defaultHandlers } from "./handlers.js";

export const server = setupServer(...defaultHandlers);
```

- [ ] **Step 2: Wire MSW into the test setup**

Add to the end of `apps/web/src/test/setup.ts`:

```ts
import { server } from "./server.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 3: Write the failing test**

Create `apps/web/src/lib/http.test.ts`:

```ts
import { http as mock, HttpResponse } from "msw";
import { server } from "../test/server.js";
import { http, ApiError } from "./http.js";

describe("http", () => {
  it("gets and parses JSON", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([{ id: "1", name: "Acme" }])),
    );
    const data = await http.get<Array<{ id: string; name: string }>>("/clients");
    expect(data).toEqual([{ id: "1", name: "Acme" }]);
  });

  it("posts a body and returns the created resource", async () => {
    server.use(
      mock.post("/api/clients", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({ id: "2", name: body.name }, { status: 201 });
      }),
    );
    const created = await http.post<{ id: string; name: string }>("/clients", { name: "New" });
    expect(created).toEqual({ id: "2", name: "New" });
  });

  it("returns void for a 204 delete", async () => {
    server.use(mock.delete("/api/clients/1", () => new HttpResponse(null, { status: 204 })));
    await expect(http.del("/clients/1")).resolves.toBeUndefined();
  });

  it("throws ApiError carrying status, message and details on a non-2xx response", async () => {
    server.use(
      mock.post("/api/clients", () =>
        HttpResponse.json(
          { error: { message: "Validation error", details: [{ path: ["name"], message: "name is required" }] } },
          { status: 400 },
        ),
      ),
    );
    const err = await http.post("/clients", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe("Validation error");
    expect(err.details).toEqual([{ path: ["name"], message: "name is required" }]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test:web -- src/lib/http.test.ts`
Expected: FAIL — cannot resolve `./http.js`.

- [ ] **Step 5: Implement the HTTP client**

Create `apps/web/src/lib/http.ts`:

```ts
export class ApiError extends Error {
  status: number;
  details: unknown[];

  constructor(message: string, status: number, details: unknown[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface ErrorEnvelope {
  error?: { message?: string; details?: unknown[] };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let details: unknown[] = [];
    try {
      const body = (await res.json()) as ErrorEnvelope;
      if (body.error?.message) message = body.error.message;
      if (Array.isArray(body.error?.details)) details = body.error.details;
    } catch {
      // non-JSON error body; keep the status-based message
    }
    throw new ApiError(message, res.status, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path: string) => request<void>(path, { method: "DELETE" }),
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:web -- src/lib/http.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/http.ts apps/web/src/lib/http.test.ts apps/web/src/test
git commit -m "feat(web): add http client with ApiError and MSW harness"
```

---

### Task 3: i18n dictionary and `t()`

**Files:**
- Create: `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/en.test.ts`

**Interfaces:**
- Produces: `type MessageKey`, `function t(key: MessageKey): string`, and `const en: Record<MessageKey, string>`. Every UI string later in the plan is one of these keys.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/i18n/en.test.ts`:

```ts
import { t } from "./en.js";

describe("t", () => {
  it("returns the English copy for a key", () => {
    expect(t("clients.section")).toBe("Clients");
    expect(t("action.create")).toBe("Create");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- src/i18n/en.test.ts`
Expected: FAIL — cannot resolve `./en.js`.

- [ ] **Step 3: Implement the dictionary**

Create `apps/web/src/i18n/en.ts`:

```ts
export const en = {
  "brand.title": "AdPulse",
  "clients.section": "Clients",
  "clients.new": "New client",
  "clients.empty.title": "Select a client",
  "clients.empty.description": "Or add a new one from the sidebar",
  "clients.notFound.title": "Client not found",
  "clients.notFound.description": "It may have been deleted",
  "client.edit": "Edit",
  "client.delete": "Delete",
  "client.delete.title": "Delete client?",
  "client.delete.body": "This permanently deletes the client and its campaigns.",
  "form.new.title": "New client",
  "form.edit.title": "Edit client",
  "form.name.label": "Name",
  "form.niche.label": "Niche",
  "form.budget.label": "Budget $/mo",
  "form.email.label": "Client email",
  "action.cancel": "Cancel",
  "action.create": "Create",
  "action.save": "Save",
  "action.delete": "Delete",
  "state.error.title": "Something went wrong",
  "state.retry": "Retry",
} as const;

export type MessageKey = keyof typeof en;

export function t(key: MessageKey): string {
  return en[key];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- src/i18n/en.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/i18n
git commit -m "feat(web): add English copy dictionary and t helper"
```

---

### Task 4: `Button` component

**Files:**
- Create: `apps/web/src/components/Button/Button.tsx`, `apps/web/src/components/Button/Button.module.css`, `apps/web/src/components/Button/Button.test.tsx`

**Interfaces:**
- Produces: `Button` with props `React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "dashed" | "danger"; size?: "sm" | "md" }`. Default `variant="primary"`, `size="md"`. Renders `data-variant`/`data-size` for styling.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/Button/Button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renders its label and defaults to the primary variant", () => {
    render(<Button>Create</Button>);
    const button = screen.getByRole("button", { name: "Create" });
    expect(button).toHaveAttribute("data-variant", "primary");
  });

  it("applies the requested variant", () => {
    render(<Button variant="dashed">New client</Button>);
    expect(screen.getByRole("button", { name: "New client" })).toHaveAttribute(
      "data-variant",
      "dashed",
    );
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- src/components/Button/Button.test.tsx`
Expected: FAIL — cannot resolve `./Button.js`.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/components/Button/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "ghost" | "dashed" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      className={[styles.button, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
```

Create `apps/web/src/components/Button/Button.module.css`:

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-weight: 600;
  transition: filter 0.15s ease, background 0.15s ease;
}

.button[data-size="md"] {
  padding: var(--space-3) var(--space-4);
  font-size: 14px;
}

.button[data-size="sm"] {
  padding: var(--space-2) var(--space-3);
  font-size: 13px;
}

.button[data-variant="primary"] {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.button[data-variant="ghost"] {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}

.button[data-variant="dashed"] {
  background: transparent;
  color: var(--color-accent);
  border: 1px dashed var(--color-accent);
}

.button[data-variant="danger"] {
  background: var(--color-danger);
  color: var(--color-accent-contrast);
}

.button:hover:not(:disabled) {
  filter: brightness(1.08);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- src/components/Button/Button.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Button
git commit -m "feat(web): add Button component"
```

---

### Task 5: `Avatar` component

**Files:**
- Create: `apps/web/src/components/Avatar/Avatar.tsx`, `apps/web/src/components/Avatar/Avatar.module.css`, `apps/web/src/components/Avatar/Avatar.test.tsx`

**Interfaces:**
- Produces: `Avatar` with props `{ name: string; size?: "sm" | "md" | "lg" }`. Shows the uppercased first character; background is one of `--color-avatar-1..5`, chosen deterministically from `name`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/Avatar/Avatar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar.js";

describe("Avatar", () => {
  it("shows the uppercased initial", () => {
    render(<Avatar name="acme" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("is deterministic for the same name", () => {
    const { container: a } = render(<Avatar name="Acme" />);
    const { container: b } = render(<Avatar name="Acme" />);
    const colorA = (a.firstChild as HTMLElement).style.background;
    const colorB = (b.firstChild as HTMLElement).style.background;
    expect(colorA).toBe(colorB);
    expect(colorA).toMatch(/var\(--color-avatar-[1-5]\)/);
  });

  it("falls back to '?' for an empty name", () => {
    render(<Avatar name="" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- src/components/Avatar/Avatar.test.tsx`
Expected: FAIL — cannot resolve `./Avatar.js`.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/components/Avatar/Avatar.tsx`:

```tsx
import styles from "./Avatar.module.css";

const PALETTE_SIZE = 5;

export interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

function paletteIndex(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return (sum % PALETTE_SIZE) + 1;
}

export function Avatar({ name, size = "md" }: AvatarProps) {
  const initial = name.trim() ? name.trim()[0].toUpperCase() : "?";
  const background = `var(--color-avatar-${paletteIndex(name)})`;
  return (
    <span className={styles.avatar} data-size={size} style={{ background }} aria-hidden="true">
      {initial}
    </span>
  );
}
```

Create `apps/web/src/components/Avatar/Avatar.module.css`:

```css
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  color: var(--color-accent-contrast);
  font-weight: 700;
}

.avatar[data-size="sm"] {
  width: 28px;
  height: 28px;
  font-size: 13px;
}

.avatar[data-size="md"] {
  width: 40px;
  height: 40px;
  font-size: 16px;
}

.avatar[data-size="lg"] {
  width: 48px;
  height: 48px;
  font-size: 20px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- src/components/Avatar/Avatar.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Avatar
git commit -m "feat(web): add Avatar component"
```

---

### Task 6: `SectionLabel`, `ListItem`, `EmptyState` (presentational statics)

**Files:**
- Create under `apps/web/src/components/`: `SectionLabel/SectionLabel.tsx` + `.module.css`, `ListItem/ListItem.tsx` + `.module.css`, `EmptyState/EmptyState.tsx` + `.module.css`, and one test file each.

**Interfaces:**
- Produces:
  - `SectionLabel` — props `{ children: React.ReactNode }`.
  - `ListItem` — props `{ selected?: boolean; leading?: React.ReactNode; onClick?: () => void; children: React.ReactNode }`; renders a `<button>` with `data-selected`.
  - `EmptyState` — props `{ icon?: React.ReactNode; title: string; description?: string }`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/SectionLabel/SectionLabel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { SectionLabel } from "./SectionLabel.js";

describe("SectionLabel", () => {
  it("renders its text", () => {
    render(<SectionLabel>Clients</SectionLabel>);
    expect(screen.getByText("Clients")).toBeInTheDocument();
  });
});
```

Create `apps/web/src/components/ListItem/ListItem.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListItem } from "./ListItem.js";

describe("ListItem", () => {
  it("renders leading content and children", () => {
    render(<ListItem leading={<span>L</span>}>Acme</ListItem>);
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("reflects the selected state", () => {
    render(<ListItem selected>Acme</ListItem>);
    expect(screen.getByRole("button", { name: /Acme/ })).toHaveAttribute("data-selected", "true");
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<ListItem onClick={onClick}>Acme</ListItem>);
    await userEvent.click(screen.getByRole("button", { name: /Acme/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

Create `apps/web/src/components/EmptyState/EmptyState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState.js";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="Select a client" description="Add one from the sidebar" />);
    expect(screen.getByText("Select a client")).toBeInTheDocument();
    expect(screen.getByText("Add one from the sidebar")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- src/components/SectionLabel src/components/ListItem src/components/EmptyState`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `SectionLabel`**

Create `apps/web/src/components/SectionLabel/SectionLabel.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./SectionLabel.module.css";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className={styles.label}>{children}</div>;
}
```

Create `apps/web/src/components/SectionLabel/SectionLabel.module.css`:

```css
.label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
```

- [ ] **Step 4: Implement `ListItem`**

Create `apps/web/src/components/ListItem/ListItem.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./ListItem.module.css";

export interface ListItemProps {
  selected?: boolean;
  leading?: ReactNode;
  onClick?: () => void;
  children: ReactNode;
}

export function ListItem({ selected = false, leading, onClick, children }: ListItemProps) {
  return (
    <button
      type="button"
      className={styles.item}
      data-selected={selected}
      onClick={onClick}
    >
      {leading != null && <span className={styles.leading}>{leading}</span>}
      <span className={styles.content}>{children}</span>
    </button>
  );
}
```

Create `apps/web/src/components/ListItem/ListItem.module.css`:

```css
.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  text-align: left;
}

.item:hover {
  background: var(--color-surface);
}

.item[data-selected="true"] {
  background: var(--color-surface);
  border-color: var(--color-border);
}

.leading {
  display: inline-flex;
  flex-shrink: 0;
}

.content {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: Implement `EmptyState`**

Create `apps/web/src/components/EmptyState/EmptyState.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      {icon != null && <div className={styles.icon}>{icon}</div>}
      <h2 className={styles.title}>{title}</h2>
      {description != null && <p className={styles.description}>{description}</p>}
    </div>
  );
}
```

Create `apps/web/src/components/EmptyState/EmptyState.module.css`:

```css
.wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 100%;
  text-align: center;
}

.icon {
  font-size: 40px;
  margin-bottom: var(--space-2);
}

.title {
  font-size: 18px;
  font-weight: 700;
}

.description {
  color: var(--color-text-muted);
  font-size: 14px;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:web -- src/components/SectionLabel src/components/ListItem src/components/EmptyState`
Expected: PASS, 5 tests total.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/SectionLabel apps/web/src/components/ListItem apps/web/src/components/EmptyState
git commit -m "feat(web): add SectionLabel, ListItem and EmptyState components"
```

---

### Task 7: `TextField` component

**Files:**
- Create: `apps/web/src/components/TextField/TextField.tsx`, `apps/web/src/components/TextField/TextField.module.css`, `apps/web/src/components/TextField/TextField.test.tsx`

**Interfaces:**
- Produces: `TextField` with props `React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }`. Associates label and input via a generated id; sets `aria-invalid` and `aria-describedby` when `error` is present.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/TextField/TextField.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "./TextField.js";

describe("TextField", () => {
  it("associates the label with the input", () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText("Name")).toBeInstanceOf(HTMLInputElement);
  });

  it("shows an error and marks the input invalid", () => {
    render(<TextField label="Name" error="name is required" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("name is required")).toBeInTheDocument();
  });

  it("forwards typing through value/onChange", async () => {
    const onChange = vi.fn();
    render(<TextField label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Name"), "A");
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- src/components/TextField/TextField.test.tsx`
Expected: FAIL — cannot resolve `./TextField.js`.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/components/TextField/TextField.tsx`:

```tsx
import { useId, type InputHTMLAttributes } from "react";
import styles from "./TextField.module.css";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error != null && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
```

Create `apps/web/src/components/TextField/TextField.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.input {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text);
}

.input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.input[aria-invalid="true"] {
  border-color: var(--color-danger);
}

.error {
  font-size: 12px;
  color: var(--color-danger);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- src/components/TextField/TextField.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TextField
git commit -m "feat(web): add TextField component"
```

---

### Task 8: `Dialog` component

**Files:**
- Create: `apps/web/src/components/Dialog/Dialog.tsx`, `apps/web/src/components/Dialog/Dialog.module.css`, `apps/web/src/components/Dialog/Dialog.test.tsx`

**Interfaces:**
- Produces: `Dialog` with props `{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }`. Built on native `<dialog>`; opens with `showModal()`, closes with `close()`, and invokes `onClose` on the native `close` event (Esc). Inner content mounts only while `open` so consumers get fresh state each open.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/Dialog/Dialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "./Dialog.js";

describe("Dialog", () => {
  it("shows the title and content when open", () => {
    render(
      <Dialog open onClose={() => {}} title="New client">
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByText("New client")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <Dialog open={false} onClose={() => {}} title="New client">
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
  });

  it("calls onClose when the dialog emits a close event", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="New client">
        <p>Body</p>
      </Dialog>,
    );
    fireEvent(screen.getByRole("dialog", { hidden: true }), new Event("close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- src/components/Dialog/Dialog.test.tsx`
Expected: FAIL — cannot resolve `./Dialog.js`.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/components/Dialog/Dialog.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handle = () => onClose();
    dialog.addEventListener("close", handle);
    return () => dialog.removeEventListener("close", handle);
  }, [onClose]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-label={title}>
      {open && (
        <div className={styles.body}>
          <h2 className={styles.title}>{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
```

Create `apps/web/src/components/Dialog/Dialog.module.css`:

```css
.dialog {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0;
  width: min(440px, calc(100vw - 2 * var(--space-4)));
}

.dialog::backdrop {
  background: rgba(0, 0, 0, 0.6);
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
}

.title {
  font-size: 20px;
  font-weight: 700;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- src/components/Dialog/Dialog.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Dialog
git commit -m "feat(web): add Dialog component on native dialog element"
```

---

### Task 9: `Sidebar` and `AppShell` layout

**Files:**
- Create: `apps/web/src/components/Sidebar/Sidebar.tsx` + `.module.css`, `apps/web/src/components/AppShell/AppShell.tsx` + `.module.css`, and one test file each.

**Interfaces:**
- Produces:
  - `Sidebar` — props `{ header?: ReactNode; children: ReactNode; action?: ReactNode; footer?: ReactNode }`. Column layout: `header` on top, scrollable `children`, `action` pinned below the scroll area, optional `footer`.
  - `AppShell` — props `{ sidebar: ReactNode; children: ReactNode }`. Two-column grid `var(--sidebar-width) | 1fr`, full viewport height.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/AppShell/AppShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell.js";

describe("AppShell", () => {
  it("renders the sidebar and the main content", () => {
    render(<AppShell sidebar={<nav>Nav</nav>}>Main</AppShell>);
    expect(screen.getByText("Nav")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Main");
  });
});
```

Create `apps/web/src/components/Sidebar/Sidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar.js";

describe("Sidebar", () => {
  it("renders header, children and action", () => {
    render(
      <Sidebar header={<div>Brand</div>} action={<button>New</button>}>
        <div>List</div>
      </Sidebar>,
    );
    expect(screen.getByText("Brand")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("omits the footer region when no footer is given", () => {
    const { container } = render(<Sidebar>List</Sidebar>);
    expect(container.querySelector('[data-region="footer"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- src/components/AppShell src/components/Sidebar`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `AppShell`**

Create `apps/web/src/components/AppShell/AppShell.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

export interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      {sidebar}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
```

Create `apps/web/src/components/AppShell/AppShell.module.css`:

```css
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  height: 100vh;
  overflow: hidden;
}

.main {
  overflow: auto;
  padding: var(--space-6);
}
```

- [ ] **Step 4: Implement `Sidebar`**

Create `apps/web/src/components/Sidebar/Sidebar.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./Sidebar.module.css";

export interface SidebarProps {
  header?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
}

export function Sidebar({ header, children, action, footer }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      {header != null && <div data-region="header">{header}</div>}
      <div className={styles.scroll} data-region="list">
        {children}
      </div>
      {action != null && (
        <div className={styles.action} data-region="action">
          {action}
        </div>
      )}
      {footer != null && (
        <div className={styles.footer} data-region="footer">
          {footer}
        </div>
      )}
    </aside>
  );
}
```

Create `apps/web/src/components/Sidebar/Sidebar.module.css`:

```css
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: var(--space-4);
  gap: var(--space-4);
}

.scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.action {
  flex-shrink: 0;
}

.footer {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:web -- src/components/AppShell src/components/Sidebar`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/AppShell apps/web/src/components/Sidebar
git commit -m "feat(web): add AppShell and Sidebar layout components"
```

---

### Task 10: Client API layer and query hooks

**Files:**
- Create: `apps/web/src/features/clients/api.ts`, `apps/web/src/features/clients/queries.ts`, `apps/web/src/lib/queryClient.ts`, `apps/web/src/test/utils.tsx`, `apps/web/src/features/clients/queries.test.tsx`

**Interfaces:**
- Consumes: `http`, `ApiError` from `lib/http.ts`.
- Produces:
  - `interface Client { id: string; name: string; niche: string | null; monthlyBudget: string | null; email: string | null; createdAt: string; updatedAt: string }`
  - `interface ClientInput { name: string; niche?: string; monthlyBudget?: number; email?: string }`
  - `api`: `listClients(): Promise<Client[]>`, `createClient(body: ClientInput): Promise<Client>`, `updateClient(id, body: ClientInput): Promise<Client>`, `deleteClient(id): Promise<void>`.
  - Hooks: `useClients()`, `useCreateClient()`, `useUpdateClient()`, `useDeleteClient()` — mutations invalidate `["clients"]`.
  - `createQueryClient()` and test helpers `renderWithProviders(ui, { route })` and `hookWrapper()`.

- [ ] **Step 1: Create the shared QueryClient factory**

Create `apps/web/src/lib/queryClient.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
```

- [ ] **Step 2: Create the test provider helpers**

Create `apps/web/src/test/utils.tsx`:

```tsx
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "../lib/queryClient.js";

export function renderWithProviders(ui: ReactElement, options?: { route?: string }) {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options?.route ?? "/"]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export function hookWrapper() {
  const client = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
```

- [ ] **Step 3: Write the failing test**

Create `apps/web/src/features/clients/queries.test.tsx`:

```tsx
import { http as mock, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { server } from "../../test/server.js";
import { hookWrapper } from "../../test/utils.js";
import { useClients, useCreateClient } from "./queries.js";

describe("client queries", () => {
  it("useClients returns the list", async () => {
    server.use(
      mock.get("/api/clients", () =>
        HttpResponse.json([
          { id: "1", name: "Acme", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" },
        ]),
      ),
    );
    const { result } = renderHook(() => useClients(), { wrapper: hookWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("Acme");
  });

  it("useCreateClient posts the input and resolves the created client", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/clients", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { id: "2", name: "New", niche: null, monthlyBudget: "1000", email: null, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );
    const { result } = renderHook(() => useCreateClient(), { wrapper: hookWrapper() });
    const created = await result.current.mutateAsync({ name: "New", monthlyBudget: 1000 });
    expect(received).toEqual({ name: "New", monthlyBudget: 1000 });
    expect(created.id).toBe("2");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test:web -- src/features/clients/queries.test.tsx`
Expected: FAIL — cannot resolve `./queries.js`.

- [ ] **Step 5: Implement the API layer**

Create `apps/web/src/features/clients/api.ts`:

```ts
import { http } from "../../lib/http.js";

export interface Client {
  id: string;
  name: string;
  niche: string | null;
  monthlyBudget: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInput {
  name: string;
  niche?: string;
  monthlyBudget?: number;
  email?: string;
}

export const clientsApi = {
  list: () => http.get<Client[]>("/clients"),
  create: (body: ClientInput) => http.post<Client>("/clients", body),
  update: (id: string, body: ClientInput) => http.patch<Client>(`/clients/${id}`, body),
  remove: (id: string) => http.del(`/clients/${id}`),
};
```

- [ ] **Step 6: Implement the hooks**

Create `apps/web/src/features/clients/queries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi, type ClientInput } from "./api.js";

const CLIENTS_KEY = ["clients"] as const;

export function useClients() {
  return useQuery({ queryKey: CLIENTS_KEY, queryFn: clientsApi.list });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientInput) => clientsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ClientInput }) => clientsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test:web -- src/features/clients/queries.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/clients/api.ts apps/web/src/features/clients/queries.ts apps/web/src/lib/queryClient.ts apps/web/src/test/utils.tsx apps/web/src/features/clients/queries.test.tsx
git commit -m "feat(web): add client api and query hooks"
```

---

### Task 11: `ClientFormDialog` (create and edit)

**Files:**
- Create: `apps/web/src/features/clients/ClientFormDialog.tsx`, `apps/web/src/features/clients/ClientFormDialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog`, `TextField`, `Button`, `t`, `useCreateClient`, `useUpdateClient`, `Client`, `ClientInput`, `ApiError`.
- Produces: `ClientFormDialog` with props `{ client?: Client; onClose: () => void; onCreated?: (client: Client) => void }`. Always visible while mounted (parent mounts/unmounts). Create mode when `client` is undefined, edit mode otherwise. Builds `ClientInput` from fields: trims text, omits empty optionals, converts a non-empty budget to a number. Maps `ApiError.details` (`{ path: [field] }`) to per-field errors.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/clients/ClientFormDialog.test.tsx`:

```tsx
import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../../test/server.js";
import { renderWithProviders } from "../../test/utils.js";
import { ClientFormDialog } from "./ClientFormDialog.js";

describe("ClientFormDialog", () => {
  it("creates a client, sending trimmed name and numeric budget", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/clients", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { id: "9", name: "Acme", niche: null, monthlyBudget: "1000", email: null, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<ClientFormDialog onClose={onClose} />);

    await userEvent.type(screen.getByLabelText("Name"), "  Acme  ");
    await userEvent.type(screen.getByLabelText("Budget $/mo"), "1000");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(received).toEqual({ name: "Acme", monthlyBudget: 1000 });
  });

  it("shows field errors from a 400 response", async () => {
    server.use(
      mock.post("/api/clients", () =>
        HttpResponse.json(
          { error: { message: "Validation error", details: [{ path: ["name"], message: "name is required" }] } },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<ClientFormDialog onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("name is required")).toBeInTheDocument();
  });

  it("prefills fields in edit mode and saves with PATCH", async () => {
    let method = "";
    server.use(
      mock.patch("/api/clients/1", async ({ request }) => {
        method = request.method;
        return HttpResponse.json(
          { id: "1", name: "Renamed", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" },
        );
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(
      <ClientFormDialog
        onClose={onClose}
        client={{ id: "1", name: "Acme", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" }}
      />,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Acme");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(method).toBe("PATCH");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- src/features/clients/ClientFormDialog.test.tsx`
Expected: FAIL — cannot resolve `./ClientFormDialog.js`.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/features/clients/ClientFormDialog.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { Dialog } from "../../components/Dialog/Dialog.js";
import { TextField } from "../../components/TextField/TextField.js";
import { Button } from "../../components/Button/Button.js";
import { ApiError } from "../../lib/http.js";
import { t } from "../../i18n/en.js";
import { useCreateClient, useUpdateClient } from "./queries.js";
import type { Client, ClientInput } from "./api.js";

export interface ClientFormDialogProps {
  client?: Client;
  onClose: () => void;
  onCreated?: (client: Client) => void;
}

type Fields = { name: string; niche: string; monthlyBudget: string; email: string };

function initialFields(client?: Client): Fields {
  return {
    name: client?.name ?? "",
    niche: client?.niche ?? "",
    monthlyBudget: client?.monthlyBudget ?? "",
    email: client?.email ?? "",
  };
}

function toInput(fields: Fields): ClientInput {
  const input: ClientInput = { name: fields.name.trim() };
  if (fields.niche.trim()) input.niche = fields.niche.trim();
  if (fields.monthlyBudget.trim()) input.monthlyBudget = Number(fields.monthlyBudget);
  if (fields.email.trim()) input.email = fields.email.trim();
  return input;
}

function fieldErrors(error: unknown): Partial<Record<keyof Fields, string>> {
  if (!(error instanceof ApiError)) return {};
  const errors: Partial<Record<keyof Fields, string>> = {};
  for (const issue of error.details) {
    const path = (issue as { path?: unknown[] }).path;
    const message = (issue as { message?: string }).message;
    const key = Array.isArray(path) ? String(path[0]) : "";
    if (key in initialFields() && message) errors[key as keyof Fields] = message;
  }
  return errors;
}

export function ClientFormDialog({ client, onClose, onCreated }: ClientFormDialogProps) {
  const isEdit = client != null;
  const [fields, setFields] = useState<Fields>(() => initialFields(client));
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const create = useCreateClient();
  const update = useUpdateClient();

  const set = (key: keyof Fields) => (e: { target: { value: string } }) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const input = toInput(fields);
    try {
      if (isEdit) {
        await update.mutateAsync({ id: client.id, body: input });
      } else {
        const created = await create.mutateAsync(input);
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open onClose={onClose} title={t(isEdit ? "form.edit.title" : "form.new.title")}>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <TextField label={t("form.name.label")} value={fields.name} onChange={set("name")} error={errors.name} autoFocus />
        <TextField label={t("form.niche.label")} value={fields.niche} onChange={set("niche")} error={errors.niche} />
        <TextField label={t("form.budget.label")} value={fields.monthlyBudget} onChange={set("monthlyBudget")} error={errors.monthlyBudget} inputMode="decimal" />
        <TextField label={t("form.email.label")} value={fields.email} onChange={set("email")} error={errors.email} type="email" />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
          <Button variant="ghost" type="button" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={pending}>
            {t(isEdit ? "action.save" : "action.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- src/features/clients/ClientFormDialog.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/clients/ClientFormDialog.tsx apps/web/src/features/clients/ClientFormDialog.test.tsx
git commit -m "feat(web): add client create/edit form dialog"
```

---

### Task 12: `BrandHeader` and `ClientSidebar`

**Files:**
- Create: `apps/web/src/features/clients/BrandHeader.tsx` + `BrandHeader.module.css`, `apps/web/src/features/clients/ClientSidebar.tsx` + `ClientSidebar.module.css`, `apps/web/src/features/clients/ClientSidebar.test.tsx`

**Interfaces:**
- Consumes: `Sidebar`, `SectionLabel`, `ListItem`, `Avatar`, `Button`, `t`, `useClients`, `ClientFormDialog`, react-router `useNavigate`/`useParams`.
- Produces: `BrandHeader` (no props — renders the wordmark) and `ClientSidebar` (no props). The sidebar lists clients, marks the one matching the `:clientId` route param as selected, navigates to `/clients/:id` on click, shows loading/error/empty states, and opens `ClientFormDialog` from the "New client" button (navigating to the created client).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/clients/ClientSidebar.test.tsx`:

```tsx
import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { server } from "../../test/server.js";
import { renderWithProviders } from "../../test/utils.js";
import { ClientSidebar } from "./ClientSidebar.js";

function setup(route = "/") {
  return renderWithProviders(
    <Routes>
      <Route path="*" element={<ClientSidebar />} />
    </Routes>,
    { route },
  );
}

describe("ClientSidebar", () => {
  it("renders clients from the API", async () => {
    server.use(
      mock.get("/api/clients", () =>
        HttpResponse.json([
          { id: "1", name: "Acme", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" },
        ]),
      ),
    );
    setup();
    expect(await screen.findByText("Acme")).toBeInTheDocument();
  });

  it("shows an empty state when there are no clients", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([])));
    setup();
    expect(await screen.findByRole("button", { name: /New client/ })).toBeInTheDocument();
  });

  it("shows an error state with a retry button on failure", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json({ error: { message: "boom" } }, { status: 500 })));
    setup();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("opens the new-client dialog", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([])));
    setup();
    await userEvent.click(await screen.findByRole("button", { name: /New client/ }));
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- src/features/clients/ClientSidebar.test.tsx`
Expected: FAIL — cannot resolve `./ClientSidebar.js`.

- [ ] **Step 3: Implement `BrandHeader`**

Create `apps/web/src/features/clients/BrandHeader.tsx`:

```tsx
import { t } from "../../i18n/en.js";
import styles from "./BrandHeader.module.css";

export function BrandHeader() {
  return <div className={styles.brand}>{t("brand.title")}</div>;
}
```

Create `apps/web/src/features/clients/BrandHeader.module.css`:

```css
.brand {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
```

- [ ] **Step 4: Implement `ClientSidebar`**

Create `apps/web/src/features/clients/ClientSidebar.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "../../components/Sidebar/Sidebar.js";
import { SectionLabel } from "../../components/SectionLabel/SectionLabel.js";
import { ListItem } from "../../components/ListItem/ListItem.js";
import { Avatar } from "../../components/Avatar/Avatar.js";
import { Button } from "../../components/Button/Button.js";
import { t } from "../../i18n/en.js";
import { useClients } from "./queries.js";
import { BrandHeader } from "./BrandHeader.js";
import { ClientFormDialog } from "./ClientFormDialog.js";
import styles from "./ClientSidebar.module.css";

export function ClientSidebar() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const clients = useClients();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Sidebar
        header={<BrandHeader />}
        action={
          <Button variant="dashed" style={{ width: "100%" }} onClick={() => setCreating(true)}>
            + {t("clients.new")}
          </Button>
        }
      >
        <SectionLabel>{t("clients.section")}</SectionLabel>

        {clients.isPending && (
          <div className={styles.state}>
            <span className={styles.skeleton} />
            <span className={styles.skeleton} />
          </div>
        )}

        {clients.isError && (
          <div className={styles.state}>
            <p className={styles.stateText}>{t("state.error.title")}</p>
            <Button variant="ghost" size="sm" onClick={() => clients.refetch()}>
              {t("state.retry")}
            </Button>
          </div>
        )}

        {clients.isSuccess &&
          clients.data.map((client) => (
            <ListItem
              key={client.id}
              selected={client.id === clientId}
              leading={<Avatar name={client.name} size="sm" />}
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              {client.name}
            </ListItem>
          ))}
      </Sidebar>

      {creating && (
        <ClientFormDialog
          onClose={() => setCreating(false)}
          onCreated={(client) => navigate(`/clients/${client.id}`)}
        />
      )}
    </>
  );
}
```

Create `apps/web/src/features/clients/ClientSidebar.module.css`:

```css
.state {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}

.stateText {
  font-size: 13px;
  color: var(--color-text-muted);
}

.skeleton {
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--color-bg);
  opacity: 0.6;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:web -- src/features/clients/ClientSidebar.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/clients/BrandHeader.tsx apps/web/src/features/clients/BrandHeader.module.css apps/web/src/features/clients/ClientSidebar.tsx apps/web/src/features/clients/ClientSidebar.module.css apps/web/src/features/clients/ClientSidebar.test.tsx
git commit -m "feat(web): add client sidebar with brand header and states"
```

---

### Task 13: `ClientHeader`, `ClientPage`, routing and app wiring

**Files:**
- Create: `apps/web/src/features/clients/ClientHeader.tsx` + `ClientHeader.module.css`, `apps/web/src/features/clients/ClientPage.tsx`, `apps/web/src/routes/EmptyRoute.tsx`, `apps/web/src/features/clients/ClientPage.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `AppShell`, `EmptyState`, `Avatar`, `Button`, `Dialog`, `t`, `useClients`, `useDeleteClient`, `ClientFormDialog`, react-router `useParams`/`useNavigate`/`Routes`/`Route`/`Outlet`.
- Produces:
  - `ClientHeader` — props `{ client: Client; onEdit: () => void; onDelete: () => void }`: avatar, name, Edit and Delete buttons.
  - `ClientPage` — reads `:clientId`, finds the client in the cached list; renders a not-found `EmptyState` if absent; otherwise `ClientHeader`, an edit `ClientFormDialog` and a delete-confirm `Dialog` that navigates to `/` on success.
  - `EmptyRoute` — the index empty state.
  - `App` — providers + router: layout route wraps `AppShell`, index → `EmptyRoute`, `/clients/:clientId` → `ClientPage`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/clients/ClientPage.test.tsx`:

```tsx
import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { server } from "../../test/server.js";
import { renderWithProviders } from "../../test/utils.js";
import { ClientPage } from "./ClientPage.js";
import { EmptyState } from "../../components/EmptyState/EmptyState.js";

const client = { id: "1", name: "Acme", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" };

function setup(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<EmptyState title="root" />} />
      <Route path="/clients/:clientId" element={<ClientPage />} />
    </Routes>,
    { route },
  );
}

describe("ClientPage", () => {
  it("shows the selected client's header", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([client])));
    setup("/clients/1");
    expect(await screen.findByRole("heading", { name: "Acme" })).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown id", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([client])));
    setup("/clients/999");
    expect(await screen.findByText("Client not found")).toBeInTheDocument();
  });

  it("deletes after confirmation and navigates home", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.delete("/api/clients/1", () => new HttpResponse(null, { status: 204 })),
    );
    setup("/clients/1");
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    // confirm dialog's Delete button
    const confirm = await screen.findByRole("button", { name: "Delete client?" }).catch(() => null);
    void confirm;
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await waitFor(() => expect(screen.getByText("root")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- src/features/clients/ClientPage.test.tsx`
Expected: FAIL — cannot resolve `./ClientPage.js`.

- [ ] **Step 3: Implement `ClientHeader`**

Create `apps/web/src/features/clients/ClientHeader.tsx`:

```tsx
import { Avatar } from "../../components/Avatar/Avatar.js";
import { Button } from "../../components/Button/Button.js";
import { t } from "../../i18n/en.js";
import type { Client } from "./api.js";
import styles from "./ClientHeader.module.css";

export interface ClientHeaderProps {
  client: Client;
  onEdit: () => void;
  onDelete: () => void;
}

export function ClientHeader({ client, onEdit, onDelete }: ClientHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <Avatar name={client.name} size="lg" />
        <h1 className={styles.name}>{client.name}</h1>
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {t("client.edit")}
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          {t("client.delete")}
        </Button>
      </div>
    </header>
  );
}
```

Create `apps/web/src/features/clients/ClientHeader.module.css`:

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.name {
  font-size: 24px;
  font-weight: 800;
}

.actions {
  display: flex;
  gap: var(--space-2);
}
```

- [ ] **Step 4: Implement `ClientPage`**

Create `apps/web/src/features/clients/ClientPage.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState/EmptyState.js";
import { Dialog } from "../../components/Dialog/Dialog.js";
import { Button } from "../../components/Button/Button.js";
import { t } from "../../i18n/en.js";
import { useClients, useDeleteClient } from "./queries.js";
import { ClientHeader } from "./ClientHeader.js";
import { ClientFormDialog } from "./ClientFormDialog.js";

export function ClientPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const clients = useClients();
  const remove = useDeleteClient();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (clients.isPending) return null;

  const client = clients.data?.find((c) => c.id === clientId);
  if (!client) {
    return <EmptyState title={t("clients.notFound.title")} description={t("clients.notFound.description")} />;
  }

  async function onConfirmDelete() {
    await remove.mutateAsync(client!.id);
    setConfirming(false);
    navigate("/");
  }

  return (
    <>
      <ClientHeader client={client} onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)} />

      {editing && <ClientFormDialog client={client} onClose={() => setEditing(false)} />}

      {confirming && (
        <Dialog open onClose={() => setConfirming(false)} title={t("client.delete.title")}>
          <p>{t("client.delete.body")}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t("action.cancel")}
            </Button>
            <Button variant="danger" onClick={onConfirmDelete} disabled={remove.isPending}>
              {t("action.delete")}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
```

- [ ] **Step 5: Implement `EmptyRoute`**

Create `apps/web/src/routes/EmptyRoute.tsx`:

```tsx
import { EmptyState } from "../components/EmptyState/EmptyState.js";
import { t } from "../i18n/en.js";

export function EmptyRoute() {
  return (
    <EmptyState
      icon={<span>📊</span>}
      title={t("clients.empty.title")}
      description={t("clients.empty.description")}
    />
  );
}
```

- [ ] **Step 6: Wire the app**

Replace `apps/web/src/App.tsx`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell/AppShell.js";
import { ClientSidebar } from "./features/clients/ClientSidebar.js";
import { ClientPage } from "./features/clients/ClientPage.js";
import { EmptyRoute } from "./routes/EmptyRoute.js";
import { createQueryClient } from "./lib/queryClient.js";

const queryClient = createQueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell sidebar={<ClientSidebar />}>
          <Routes>
            <Route path="/" element={<EmptyRoute />} />
            <Route path="/clients/:clientId" element={<ClientPage />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 7: Run the page test to verify it passes**

Run: `npm run test:web -- src/features/clients/ClientPage.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 8: Run the full suite and a type/build check**

Run: `npm run test:web`
Expected: PASS, all test files.
Run: `npm run build:web`
Expected: `tsc` reports no errors and Vite builds `dist/`.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/clients/ClientHeader.tsx apps/web/src/features/clients/ClientHeader.module.css apps/web/src/features/clients/ClientPage.tsx apps/web/src/features/clients/ClientPage.test.tsx apps/web/src/routes/EmptyRoute.tsx apps/web/src/App.tsx
git commit -m "feat(web): wire routing, client page and delete confirmation"
```

---

## Self-Review

**Spec coverage:**

- Workspace (Vite/React/TS/router/Query/CSS Modules/Vitest+MSW) → Task 1, 10.
- `components/` cannot import `features/`, no domain vocabulary → enforced; all `components/*` tasks (4–9) are props-only.
- Screen areas (AppShell, Sidebar, BrandHeader, ClientList via ListItem+Avatar, NewClientButton, footer slot, ClientHeader, Outlet/EmptyState) → Tasks 6, 9, 12, 13.
- Component library table (AppShell, Button, Dialog, TextField, Avatar, SectionLabel, ListItem, EmptyState) → Tasks 4–9.
- Design tokens incl. avatar palette → Task 1; Avatar uses them → Task 5.
- Data flow (URL selection, four hooks, `http.ts` envelope parsing, budget asymmetry) → Tasks 2, 10, 11.
- Copy in `i18n/en.ts` via `t()` → Task 3, used throughout.
- States (loading/error/empty; delete confirm; not-found) → Tasks 12, 13.
- Testing (component/feature/shell, fresh QueryClient retry-off) → every task; helpers in Task 10.
- Client rows show name only (no day count) → Task 12 renders name alone.

**Placeholder scan:** No TBD/TODO; every code step carries complete code and every command an expected result.

**Type consistency:** `Client`/`ClientInput` defined in Task 10 and consumed unchanged in Tasks 11–13. `http`/`ApiError` from Task 2 used in Tasks 10–11. `useCreateClient/useUpdateClient/useDeleteClient/useClients` signatures match between Task 10 and their callers. `createQueryClient` (Task 10) used in Task 13. `renderWithProviders`/`hookWrapper` (Task 10) used in Tasks 10–13.

**Note on Task 13 delete test:** the confirm dialog adds a second "Delete" button; the test disambiguates by clicking the last-rendered one (`.at(-1)`). If that proves brittle during execution, relabel the confirm action key or scope the query with `within(dialog)` — a test-only adjustment, no source change.
