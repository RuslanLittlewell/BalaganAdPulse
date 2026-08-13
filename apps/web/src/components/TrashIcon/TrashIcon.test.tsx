import { render } from "@testing-library/react";
import { TrashIcon } from "./TrashIcon.js";

describe("TrashIcon", () => {
  it("renders a decorative svg that inherits the text colour", () => {
    const { container } = render(<TrashIcon />);
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("stroke", "currentColor");
  });
});
