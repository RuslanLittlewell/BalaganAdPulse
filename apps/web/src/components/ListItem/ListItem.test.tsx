import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListItem } from "./ListItem.js";

describe("ListItem", () => {
  it("renders leading content and children", () => {
    render(<ListItem leading={<span>L</span>}>Acme</ListItem>);
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("reflects the selected state", () => {
    render(<ListItem selected>Acme</ListItem>);
    expect(screen.getByRole("button", { name: /Acme/ })).toHaveAttribute("data-selected", "true");
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<ListItem onClick={onClick}>Acme</ListItem>);
    await userEvent.click(screen.getByRole("button", { name: /Acme/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
