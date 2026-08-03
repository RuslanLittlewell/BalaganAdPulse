import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState.js";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(<EmptyState title="Select a client" description="Add one from the sidebar" />);
    expect(screen.getByText("Select a client")).toBeInTheDocument();
    expect(screen.getByText("Add one from the sidebar")).toBeInTheDocument();
  });
});
