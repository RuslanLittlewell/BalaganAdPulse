import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dropzone } from "@/shared/ui/index.js";

const picture = () => new File(["x"], "cover.png", { type: "image/png" });
const dataTransfer = (files: File[]) => ({ files, types: ["Files"] });

function setup(disabled = false) {
  const onFile = vi.fn();
  render(<Dropzone label="Загрузить обложку" accept={["image/png"]} disabled={disabled} onFile={onFile}>Блок</Dropzone>);
  return { onFile, zone: screen.getByRole("button", { name: "Загрузить обложку" }) };
}

describe("Dropzone", () => {
  it("takes a dropped file and shows it is ready to take one while a file is over it", () => {
    const { onFile, zone } = setup();
    const file = picture();

    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer([file]) });
    expect(zone).toHaveAttribute("data-dragging");
    fireEvent.dragLeave(zone, { dataTransfer: dataTransfer([file]) });
    expect(zone).not.toHaveAttribute("data-dragging");

    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer([file]) });
    fireEvent.drop(zone, { dataTransfer: dataTransfer([file]) });
    expect(onFile).toHaveBeenCalledWith(file);
    expect(zone).not.toHaveAttribute("data-dragging");
  });

  it("opens the file choice on click and from the keyboard, and passes the chosen file on", async () => {
    const { onFile, zone } = setup();
    const opened = vi.spyOn(HTMLInputElement.prototype, "click");

    await userEvent.click(zone);
    zone.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(opened).toHaveBeenCalledTimes(3);

    const file = picture();
    await userEvent.upload(zone.querySelector("input[type=file]")!, file);
    expect(onFile).toHaveBeenCalledWith(file);
    opened.mockRestore();
  });

  it("ignores drops and clicks while disabled", async () => {
    const { onFile, zone } = setup(true);
    const opened = vi.spyOn(HTMLInputElement.prototype, "click");

    fireEvent.drop(zone, { dataTransfer: dataTransfer([picture()]) });
    await userEvent.click(zone);

    expect(onFile).not.toHaveBeenCalled();
    expect(opened).not.toHaveBeenCalled();
    expect(zone).toHaveAttribute("aria-disabled", "true");
    opened.mockRestore();
  });
});
