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
