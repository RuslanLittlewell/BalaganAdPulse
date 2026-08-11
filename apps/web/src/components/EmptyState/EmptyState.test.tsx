import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState.js";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="Select a client" description="Add one from the sidebar" />);
    expect(screen.getByText("Select a client")).toBeInTheDocument();
    expect(screen.getByText("Add one from the sidebar")).toBeInTheDocument();
  });

  it("renders an action below the description", () => {
    render(<EmptyState title="Something went wrong" action={<button type="button">Retry</button>} />);

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
