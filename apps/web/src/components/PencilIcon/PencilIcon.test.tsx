import { render } from "@testing-library/react";
import { PencilIcon } from "./PencilIcon.js";

describe("PencilIcon", () => {
  it("renders a decorative svg that inherits the text colour", () => {
    const { container } = render(<PencilIcon />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
  });
});
