import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell.js";

describe("AppShell", () => {
  it("renders the sidebar and the main content", () => {
    render(<AppShell sidebar={<nav>Nav</nav>}>Main</AppShell>);
    expect(screen.getByText("Nav")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Main");
  });
});
