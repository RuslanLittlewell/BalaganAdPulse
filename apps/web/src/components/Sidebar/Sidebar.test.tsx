import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar.js";

describe("Sidebar", () => {
  it("renders header, children and action", () => {
    render(
      <Sidebar header={<div>Brand</div>} action={<button>New</button>}>
        <div>List</div>
      </Sidebar>,
    );
    expect(screen.getByText("Brand")).toBeInTheDocument();
    expect(screen.getByText("List")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("omits the footer region when no footer is given", () => {
    const { container } = render(<Sidebar>List</Sidebar>);
    expect(container.querySelector('[data-region="footer"]')).toBeNull();
  });
});
