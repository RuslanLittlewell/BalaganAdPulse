import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "@/shared/ui/index.js";

function stubClipboard() {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } },
  });
  return written;
}

describe("CopyButton", () => {
  it("copies the value it was given", async () => {
    const user = userEvent.setup();
    const written = stubClipboard();
    render(<CopyButton value="https://example.test/link" label="Скопировать ссылку" />);

    await user.click(screen.getByRole("button", { name: "Скопировать ссылку" }));

    expect(written).toEqual(["https://example.test/link"]);
  });

  // The morph itself cannot be observed in jsdom; the state that drives it can,
  // and it is what decides which icon MorphIcon is handed.
  it("marks itself copied, and says so to a screen reader too", async () => {
    const user = userEvent.setup();
    stubClipboard();
    render(<CopyButton value="x" label="Скопировать ссылку" />);
    const button = screen.getByRole("button", { name: "Скопировать ссылку" });
    expect(button).toHaveAttribute("data-copied", "false");

    await user.click(button);

    await waitFor(() => expect(button).toHaveAttribute("data-copied", "true"));
    expect(screen.getByRole("status")).toHaveTextContent("Скопировано");
  });

  it("goes back to offering the copy again", async () => {
    const user = userEvent.setup();
    stubClipboard();
    render(<CopyButton value="x" label="Скопировать ссылку" confirmMs={20} />);
    const button = screen.getByRole("button", { name: "Скопировать ссылку" });

    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute("data-copied", "true"));

    await waitFor(() => expect(button).toHaveAttribute("data-copied", "false"));
  });

  // A tick outlives a short-lived dialog easily; the revert must not land on a
  // component that is gone.
  it("survives being unmounted before it reverts", async () => {
    const user = userEvent.setup();
    stubClipboard();
    const { unmount } = render(
      <CopyButton value="x" label="Скопировать ссылку" confirmMs={20} />,
    );

    await user.click(screen.getByRole("button", { name: "Скопировать ссылку" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Скопировать ссылку" }))
        .toHaveAttribute("data-copied", "true"));
    unmount();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); });

    // No "state update on an unmounted component" warning, and no throw.
    expect(document.body.textContent).toBe("");
  });

  it("stays quiet when the browser exposes no clipboard", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<CopyButton value="x" label="Скопировать ссылку" />);

    await user.click(screen.getByRole("button", { name: "Скопировать ссылку" }));

    expect(screen.getByRole("button", { name: "Скопировать ссылку" }))
      .toHaveAttribute("data-copied", "false");
  });
});
