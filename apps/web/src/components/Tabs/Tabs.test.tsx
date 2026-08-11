import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs.js";

const items = [
  { id: "a", label: "Search ads" },
  { id: "b", label: "Display" },
];

describe("Tabs", () => {
  it("renders a tab per item and marks the active one", () => {
    render(<Tabs items={items} activeId="b" onSelect={() => {}} />);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Display" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Search ads" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect with the item id", async () => {
    const onSelect = vi.fn();
    render(<Tabs items={items} activeId="a" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("tab", { name: "Display" }));

    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("renders a trailing action that is not a tab", async () => {
    const onNew = vi.fn();
    render(
      <Tabs
        items={items}
        activeId="a"
        onSelect={() => {}}
        action={<button type="button" onClick={onNew}>+ New</button>}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    const add = screen.getByRole("button", { name: "+ New" });
    expect(add).not.toHaveAttribute("role");

    await userEvent.click(add);
    expect(onNew).toHaveBeenCalled();
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
          { icon: <span>cross</span>, label: "Delete", onSelect: onDelete },
        ]}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Rename", "Delete"]);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
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
      />,
    );

    expect(screen.getAllByRole("button", { name: "Rename" })).toHaveLength(1);
  });

  it("renders no item action when none is given", () => {
    render(<Tabs items={items} activeId="a" onSelect={() => {}} />);

    // The tabs carry role="tab", so nothing should match the plain button role.
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
