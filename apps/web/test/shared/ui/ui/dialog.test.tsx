import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/ui/dialog.js";

function open(onOpenChange = () => {}, openState = true) {
  return render(
    <Dialog open={openState} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый клиент</DialogTitle>
          <DialogDescription>Заполните поля</DialogDescription>
        </DialogHeader>
        <p>Содержимое</p>
      </DialogContent>
    </Dialog>,
  );
}

describe("Dialog", () => {
  it("names the dialog by its title and shows the content when open", () => {
    open();
    expect(screen.getByRole("dialog", { name: "Новый клиент" })).toBeInTheDocument();
    expect(screen.getByText("Содержимое")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    open(() => {}, false);
    expect(screen.queryByText("Содержимое")).not.toBeInTheDocument();
  });

  it("asks to close when the close button is clicked", async () => {
    const onOpenChange = vi.fn();
    open(onOpenChange);
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks to close when the overlay is clicked", async () => {
    const onOpenChange = vi.fn();
    open(onOpenChange);
    await userEvent.click(screen.getByTestId("dialog-overlay"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
