import { useEffect, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AppShell } from "@/widgets/app-shell/AppShell.js";
import { NavCollapseProvider } from "@/features/nav-collapse/index.js";

function MountCounter({ onMount, children }: { onMount: () => void; children: ReactNode }) {
  useEffect(() => { onMount(); }, [onMount]);
  return <div>{children}</div>;
}

function renderShell(moduleKey: string, onMount: () => void, content: string) {
  return render(
    <NavCollapseProvider>
      <AppShell sidebar={<nav>Nav</nav>} header={<header>Header</header>} moduleKey={moduleKey}>
        <MountCounter onMount={onMount}>{content}</MountCounter>
      </AppShell>
    </NavCollapseProvider>,
  );
}

describe("AppShell", () => {
  it("renders the sidebar, header and main content", () => {
    render(
      <NavCollapseProvider>
        <AppShell sidebar={<nav>Nav</nav>} header={<header>Header</header>} moduleKey="dashboard">Main</AppShell>
      </NavCollapseProvider>,
    );
    expect(screen.getByText("Nav")).toBeInTheDocument();
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Main");
  });
});

describe("AppShell module transition", () => {
  it("remounts the module content when the module changes", async () => {
    const onMount = vi.fn();
    const { rerender } = renderShell("crm", onMount, "CRM content");
    expect(onMount).toHaveBeenCalledTimes(1);

    rerender(
      <NavCollapseProvider>
        <AppShell sidebar={<nav>Nav</nav>} header={<header>Header</header>} moduleKey="tasks">
          <MountCounter onMount={onMount}>Tasks content</MountCounter>
        </AppShell>
      </NavCollapseProvider>,
    );

    await waitFor(() => expect(onMount).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Tasks content")).toBeInTheDocument();
  });

  it("does not remount the module content when it changes within the same module", () => {
    const onMount = vi.fn();
    const { rerender } = renderShell("crm", onMount, "Board view");
    expect(onMount).toHaveBeenCalledTimes(1);

    rerender(
      <NavCollapseProvider>
        <AppShell sidebar={<nav>Nav</nav>} header={<header>Header</header>} moduleKey="crm">
          <MountCounter onMount={onMount}>Calendar view</MountCounter>
        </AppShell>
      </NavCollapseProvider>,
    );

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Calendar view")).toBeInTheDocument();
  });

  it("still switches the module content when the viewer prefers reduced motion", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    const onMount = vi.fn();
    const { rerender } = renderShell("crm", onMount, "CRM content");
    expect(screen.getByText("CRM content")).toBeInTheDocument();

    rerender(
      <NavCollapseProvider>
        <AppShell sidebar={<nav>Nav</nav>} header={<header>Header</header>} moduleKey="tasks">
          <MountCounter onMount={onMount}>Tasks content</MountCounter>
        </AppShell>
      </NavCollapseProvider>,
    );

    await waitFor(() => expect(screen.getByText("Tasks content")).toBeInTheDocument());

    window.matchMedia = original;
  });
});
