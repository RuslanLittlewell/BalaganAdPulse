import { render, screen } from "@testing-library/react";
import { AppShell } from "@/widgets/app-shell/AppShell.js";
import { NavCollapseProvider } from "@/features/nav-collapse/index.js";

describe("AppShell", () => {
  it("renders the sidebar, header and main content", () => {
    render(
      <NavCollapseProvider>
        <AppShell sidebar={<nav>Nav</nav>} header={<header>Header</header>}>Main</AppShell>
      </NavCollapseProvider>,
    );
    expect(screen.getByText("Nav")).toBeInTheDocument();
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Main");
  });
});
