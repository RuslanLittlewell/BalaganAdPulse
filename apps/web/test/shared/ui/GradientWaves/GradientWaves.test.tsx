import { render } from "@testing-library/react";
import { GradientWaves } from "@/shared/ui/index.js";

describe("GradientWaves", () => {
  it("renders its container even where WebGL does not exist", () => {
    const { container } = render(<GradientWaves />);

    expect(container.firstElementChild).toBeInstanceOf(HTMLDivElement);
  });
});
