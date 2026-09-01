import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "@/shared/ui/Tabs/Tabs.js";

const items = [
  { id: "a", label: "Search ads" },
  { id: "b", label: "Display" },
];

describe("Tabs", () => {
  it("renders a tab per item and marks the active one", () => {
    render(<Tabs items={items} activeId="b" onSelect={() => {}} onNew={() => {}} />);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Display" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Search ads" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect with the item id", async () => {
    const onSelect = vi.fn();
    render(<Tabs items={items} activeId="a" onSelect={onSelect} onNew={() => {}} />);

    await userEvent.click(screen.getByRole("tab", { name: "Display" }));

    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("offers a way to add one, which is not itself a tab", async () => {
    const onNew = vi.fn();
    render(<Tabs items={items} activeId="a" onSelect={() => {}} onNew={onNew} />);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    const add = screen.getByRole("button", { name: /Новый лист/ });
    await userEvent.click(add);
    expect(onNew).toHaveBeenCalledOnce();
  });

  it("renders every item action on the active tab, in order, each reporting its id", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <Tabs
        items={items}
        activeId="b"
        onSelect={() => {}}
        itemActions={[
          { icon: <span>pencil</span>, label: "Rename", onSelect: onEdit },
          { icon: <span>cross</span>, label: "Удалить", onSelect: onDelete },
        ]}
        onNew={() => {}}
      />,
    );

    const tablist = screen.getByRole("tablist");
    const actions = within(tablist).getAllByRole("button");
    expect(actions.map((button) => button.getAttribute("aria-label"))).toEqual(["Rename", "Удалить"]);

    await userEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(onDelete).toHaveBeenCalledWith("b");
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("renders item actions on the active tab only", () => {
    render(
      <Tabs
        items={items}
        activeId="a"
        onSelect={() => {}}
        itemActions={[{ icon: <span>pencil</span>, label: "Rename", onSelect: () => {} }]}
        onNew={() => {}}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Rename" })).toHaveLength(1);
  });

  it("renders no item action when none is given", () => {
    render(<Tabs items={items} activeId="a" onSelect={() => {}} onNew={() => {}} />);

    // The add button belongs to the component, not to a tab: look inside the list.
    expect(within(screen.getByRole("tablist")).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Tabs memoisation", () => {
  it("is memoised, so a parent re-render with the same data costs nothing", () => {
    // A regression guard: dropping memo() here brings back a re-render of every
    // tab on every route change, including one that lands where you already are.
    expect((Tabs as unknown as { $$typeof: symbol }).$$typeof)
      .toBe(Symbol.for("react.memo"));
  });
});
