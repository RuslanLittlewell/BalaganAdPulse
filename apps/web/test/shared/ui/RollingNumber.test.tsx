import { render, screen } from "@testing-library/react";
import { RollingNumber } from "@/shared/ui/index.js";

describe("RollingNumber", () => {
  it("reads as the figure it shows and adds no rolling digits to the page text", () => {
    const { container } = render(<RollingNumber value="12 345 ₽" />);

    expect(screen.getByText("12 345 ₽")).toBeInTheDocument();
    expect(container).toHaveTextContent(/^12 345 ₽$/);
  });

  it("reads the new figure once the value changes", () => {
    const { rerender } = render(<RollingNumber value={95} />);

    rerender(<RollingNumber value={1200} />);

    expect(screen.getByText("1200")).toBeInTheDocument();
    expect(screen.queryByText("95")).not.toBeInTheDocument();
  });

  it("shows a missing figure as it is", () => {
    const { container } = render(<RollingNumber value="—" />);

    expect(container).toHaveTextContent(/^—$/);
  });
});
