import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "./Dialog.js";

describe("Dialog", () => {
  it("shows the title and content when open", () => {
    render(
      <Dialog open onClose={() => {}} title="New client">
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByText("New client")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <Dialog open={false} onClose={() => {}} title="New client">
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
  });

  it("calls onClose when the dialog emits a close event", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="New client">
        <p>Body</p>
      </Dialog>,
    );
    fireEvent(screen.getByRole("dialog", { hidden: true }), new Event("close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
