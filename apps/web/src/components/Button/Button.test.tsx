import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renders its label and defaults to the primary variant", () => {
    render(<Button>Create</Button>);
    const button = screen.getByRole("button", { name: "Create" });
    expect(button).toHaveAttribute("data-variant", "primary");
  });

  it("applies the requested variant", () => {
    render(<Button variant="dashed">New client</Button>);
    expect(screen.getByRole("button", { name: "New client" })).toHaveAttribute(
      "data-variant",
      "dashed",
    );
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
