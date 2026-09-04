import { render, screen } from "@testing-library/react";
import { Avatar } from "@/shared/ui/Avatar/Avatar.js";

describe("Аватар", () => {
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

  it("sizes the box itself, without handing shadcn a size to reinterpret", () => {
    const { container } = render(<Avatar name="Acme" size="lg" />);
    const root = container.firstElementChild!;

    expect(root).toHaveClass("size-14");
    expect(root).not.toHaveAttribute("data-size", "lg");
  });

  it("matches the picture it stands in for, at every size", () => {
    const boxes = { sm: "size-8", md: "size-10", lg: "size-14" } as const;
    for (const [size, box] of Object.entries(boxes)) {
      const { container, unmount } = render(
        <Avatar name="Acme" size={size as keyof typeof boxes} />,
      );
      expect(container.firstElementChild, size).toHaveClass(box);
      unmount();
    }
  });
});
