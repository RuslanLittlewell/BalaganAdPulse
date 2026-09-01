import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "@/shared/ui/TextField/TextField.js";

describe("TextField", () => {
  it("associates the label with the input", () => {
    render(<TextField label="Имя" />);
    expect(screen.getByLabelText("Имя")).toBeInstanceOf(HTMLInputElement);
  });

  it("shows an error and marks the input invalid", () => {
    render(<TextField label="Имя" error="name is required" />);
    const input = screen.getByLabelText("Имя");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("name is required")).toBeInTheDocument();
  });

  it("forwards typing through value/onChange", async () => {
    const onChange = vi.fn();
    render(<TextField label="Имя" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Имя"), "A");
    expect(onChange).toHaveBeenCalled();
  });
});
