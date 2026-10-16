import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertsProvider, useAlerts } from "@/shared/ui/index.js";
import { finishAnimations } from "@test/shared/index.js";

function Raiser() {
  const { raise } = useAlerts();
  return (
    <>
      <button type="button" onClick={() => raise("Не удалось сохранить")}>ошибка</button>
      <button type="button" onClick={() => raise("Профиль сохранён", "success")}>успех</button>
    </>
  );
}

const setup = () => render(<AlertsProvider><Raiser /></AlertsProvider>);

describe("the alert surface", () => {
  it("announces an error as an alert outside whatever raised it", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "ошибка" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не удалось сохранить");
    expect(screen.getByRole("button", { name: "ошибка" })).not.toContainElement(alert);
    expect(within(screen.getByRole("region", { name: "Уведомления" })).getByRole("alert")).toBe(alert);
  });

  it("announces a success as a status, not an alert", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "успех" }));

    const region = screen.getByRole("region", { name: "Уведомления" });
    const statuses = await within(region).findAllByRole("status");
    expect(statuses.some((status) => status.textContent?.includes("Профиль сохранён"))).toBe(true);
    expect(within(region).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stacks several alerts rather than replacing the one before", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "ошибка" }));
    await userEvent.click(screen.getByRole("button", { name: "ошибка" }));

    expect(await screen.findAllByRole("alert")).toHaveLength(2);
  });

  it("lets an alert be dismissed by its close control, leaving the others", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "ошибка" }));
    await userEvent.click(screen.getByRole("button", { name: "успех" }));
    const alert = await screen.findByRole("alert");

    await userEvent.click(within(alert).getByRole("button", { name: "Закрыть уведомление" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("Профиль сохранён")).toBeInTheDocument();
  });

  it("lets a focused alert be dismissed with Escape", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "ошибка" }));
    const alert = await screen.findByRole("alert");

    fireEvent.keyDown(within(alert).getByText("Не удалось сохранить"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("clears itself once its time runs out, so nothing piles up", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "ошибка" }));
    await screen.findByRole("alert");

    act(() => finishAnimations());

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("refuses to be used without its provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Raiser />)).toThrow(/AlertsProvider/);
    quiet.mockRestore();
  });
});
