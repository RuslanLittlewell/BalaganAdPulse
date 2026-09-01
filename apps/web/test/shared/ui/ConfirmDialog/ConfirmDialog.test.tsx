import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog/ConfirmDialog.js";

const props = {
  open: true,
  title: "Удалить клиента?",
  description: "Клиент и все его кампании будут удалены безвозвратно.",
};

describe("ConfirmDialog", () => {
  it("asks the question and offers both answers", () => {
    render(<ConfirmDialog {...props} onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("alertdialog", { name: "Удалить клиента?" })).toBeInTheDocument();
    expect(screen.getByText(props.description)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отмена" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Удалить" })).toBeInTheDocument();
  });

  it("confirms only on the confirming button", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog {...props} onConfirm={onConfirm} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("blocks a second confirmation while the first is in flight", () => {
    render(<ConfirmDialog {...props} pending onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Удалить" })).toBeDisabled();
  });

  it("takes a caller's wording for the confirming button", () => {
    render(
      <ConfirmDialog {...props} confirmLabel="Отключить" onConfirm={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Отключить" })).toBeInTheDocument();
  });
});
