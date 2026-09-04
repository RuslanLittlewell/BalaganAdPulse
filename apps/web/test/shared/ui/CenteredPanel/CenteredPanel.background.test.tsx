import { render, screen } from "@testing-library/react";
import { CenteredPanel } from "@/shared/ui/index.js";

describe("the signed-out background", () => {
  it("renders the panel even where WebGL does not exist", () => {
    render(<CenteredPanel title="Вход"><p>form</p></CenteredPanel>);

    expect(screen.getByText("form")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("keeps the rays out of the accessibility tree", () => {
    const { container } = render(<CenteredPanel title="Вход"><p>form</p></CenteredPanel>);

    const rays = container.querySelector("[data-testid='signed-out-rays']");
    expect(rays).not.toBeNull();
    expect(rays).toHaveAttribute("aria-hidden", "true");
  });
});
