import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "./TextField.js";

describe("TextField", () => {
  it("associates the label with the input", () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText("Name")).toBeInstanceOf(HTMLInputElement);
  });

  it("shows an error and marks the input invalid", () => {
    render(<TextField label="Name" error="name is required" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("name is required")).toBeInTheDocument();
  });

  it("forwards typing through value/onChange", async () => {
    const onChange = vi.fn();
    render(<TextField label="Name" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Name"), "A");
    expect(onChange).toHaveBeenCalled();
  });
});
