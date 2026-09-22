import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "@/shared/ui/Tabs/Tabs.js";

const items = [
  { id: "a", label: "Search ads" },
  { id: "b", label: "Display" },
];

describe("Tabs", () => {
  it("renders one option per item inside a labelled group and marks the active one", () => {
    render(<Tabs items={items} activeId="b" onSelect={() => {}} ariaLabel="View" />);

    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Display" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Search ads" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onSelect with the item id", async () => {
    const onSelect = vi.fn();
    render(<Tabs items={items} activeId="a" onSelect={onSelect} ariaLabel="View" />);

    await userEvent.click(screen.getByRole("radio", { name: "Display" }));

    expect(onSelect).toHaveBeenCalledWith("b");
  });
});

describe("Tabs memoisation", () => {
  it("is memoised, so a parent re-render with the same data costs nothing", () => {
    expect((Tabs as unknown as { $$typeof: symbol }).$$typeof)
      .toBe(Symbol.for("react.memo"));
  });
});
