import { render, screen } from "@testing-library/react";
import { CenteredPanel } from "@/shared/ui/index.js";

/**
 * The background is decoration drawn on WebGL, which jsdom does not have. It has
 * to be absent rather than fatal: a sign-in screen that fails to render because
 * of its wallpaper is worse than a plain one.
 */
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
