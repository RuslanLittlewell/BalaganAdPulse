import { render } from "@testing-library/react";
import { CrossIcon } from "./CrossIcon.js";

describe("CrossIcon", () => {
  it("renders a decorative svg that inherits the text colour", () => {
    const { container } = render(<CrossIcon />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
  });
});
