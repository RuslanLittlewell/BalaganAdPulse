import { render, screen } from "@testing-library/react";
import { Avatar } from "@/shared/ui/Avatar/Avatar.js";

describe("Аватар", () => {
  it("shows the uppercased initial", () => {
    render(<Avatar name="acme" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("falls back to '?' for an empty name", () => {
    render(<Avatar name="" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
