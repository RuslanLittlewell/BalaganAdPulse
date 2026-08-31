import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "@/shared/ui/DatePicker/DatePicker.js";

const labels = {
  dialog: "Выберите дату",
  previousMonth: "Предыдущий месяц",
  nextMonth: "Следующий месяц",
};

function Harness({ onSelect }: { onSelect: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <DatePicker
      value="2026-08-03"
      open={open}
      onOpenChange={setOpen}
      labels={labels}
      onSelect={onSelect}
    >
      <button type="button">03 авг.</button>
    </DatePicker>
  );
}

async function openCalendar(onSelect: (iso: string) => void = () => {}) {
  render(<Harness onSelect={onSelect} />);
  await userEvent.click(screen.getByRole("button", { name: "03 авг." }));
  return screen.getByRole("dialog", { name: "Выберите дату" });
}

describe("DatePicker", () => {
  it("stays closed until the trigger is used", () => {
    render(<Harness onSelect={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a calendar named by its label", async () => {
    expect(await openCalendar()).toBeInTheDocument();
  });

  it("opens on the month of the selected day, in Russian", async () => {
    const dialog = await openCalendar();
    expect(dialog).toHaveTextContent("август 2026");
  });

  it("marks the selected day", async () => {
    await openCalendar();
    expect(screen.getByRole("button", { name: "03 августа 2026 г." }))
      .toHaveAttribute("data-selected-single", "true");
  });

  it("reports the chosen day as an ISO date", async () => {
    const onSelect = vi.fn();
    await openCalendar(onSelect);
    await userEvent.click(screen.getByRole("button", { name: "12 августа 2026 г." }));
    expect(onSelect).toHaveBeenCalledWith("2026-08-12");
  });

  it("names its month controls in Russian", async () => {
    await openCalendar();
    expect(screen.getByRole("button", { name: "Предыдущий месяц" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Следующий месяц" })).toBeInTheDocument();
  });

  it("walks to the previous month", async () => {
    const dialog = await openCalendar();
    await userEvent.click(screen.getByRole("button", { name: "Предыдущий месяц" }));
    expect(dialog).toHaveTextContent("июль 2026");
  });

  it("closes on Escape", async () => {
    await openCalendar();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
