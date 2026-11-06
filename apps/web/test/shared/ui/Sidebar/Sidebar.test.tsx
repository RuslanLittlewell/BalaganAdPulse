import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/shared/ui/Sidebar/Sidebar.js";

describe("Sidebar", () => {
  it("renders header, children and action", () => {
    render(
      <Sidebar header={<div>Brand</div>} action={<button>New</button>}>
        <div>List</div>
      </Sidebar>,
    );
    expect(screen.getByText("Brand")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("shows no help item unless asked to", () => {
    render(<Sidebar>List</Sidebar>);
    expect(screen.queryByRole("button", { name: "Помощь" })).not.toBeInTheDocument();
  });

  it("ends with a help item that reports a click", async () => {
    const onOpen = vi.fn();
    render(<Sidebar help={{ label: "Помощь", collapsed: false, onOpen }}>List</Sidebar>);

    await userEvent.click(screen.getByRole("button", { name: "Помощь" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps the help item's name when collapsed to an icon", () => {
    render(<Sidebar help={{ label: "Помощь", collapsed: true, onOpen: () => {} }}>List</Sidebar>);
    expect(screen.getByRole("button", { name: "Помощь" })).toBeInTheDocument();
  });
});
