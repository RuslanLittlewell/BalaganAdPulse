import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertsProvider, useAlerts } from "@/shared/ui/index.js";

function AutoRaiser() {
  const { raise } = useAlerts();
  useEffect(() => { raise("Не удалось сохранить"); }, [raise]);
  return null;
}

function Raiser() {
  const { raise } = useAlerts();
  return (
    <button type="button" onClick={() => raise("Не удалось сохранить")}>поднять</button>
  );
}

const setup = () => render(<AlertsProvider><Raiser /></AlertsProvider>);

describe("the alert surface", () => {
  it("announces what went wrong outside whatever raised it", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "поднять" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не удалось сохранить");
    expect(screen.getByTestId("alerts")).toHaveAttribute("aria-live", "assertive");
  });

  it("stacks several alerts rather than replacing the one before", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "поднять" }));
    await userEvent.click(screen.getByRole("button", { name: "поднять" }));

    expect(await screen.findAllByRole("alert")).toHaveLength(2);
  });

  it("lets an alert be dismissed", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "поднять" }));
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Закрыть уведомление" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("clears itself after a while, so nothing piles up", async () => {
    vi.useFakeTimers();
    render(<AlertsProvider><AutoRaiser /></AlertsProvider>);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("refuses to be used without its provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Raiser />)).toThrow(/AlertsProvider/);
    quiet.mockRestore();
  });
});
