import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@test/shared/index.js";
import { TaskDescriptionEditor } from "@/features/task-management/index.js";

const linked = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Макет " },
        { type: "text", text: "в Figma", marks: [{ type: "link", attrs: { href: "https://figma.com/file/1" } }] },
      ],
    },
  ],
};

function describedBy(editable: boolean) {
  return renderWithProviders(
    <TaskDescriptionEditor value={linked} onChange={() => {}} editable={editable} />,
    { route: "/tasks" },
  );
}

describe("a link in a task's description", () => {
  let opened: unknown[][];

  beforeEach(() => {
    opened = [];
    vi.spyOn(window, "open").mockImplementation((...args: unknown[]) => {
      opened.push(args);
      return null;
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("opens in a new tab when clicked while the description is being edited", async () => {
    describedBy(true);

    await userEvent.click(await screen.findByText("в Figma"));

    expect(opened).toEqual([["https://figma.com/file/1", "_blank", "noopener,noreferrer"]]);
  });

  it("opens in a new tab when clicked in a description that cannot be edited", async () => {
    describedBy(false);

    await userEvent.click(await screen.findByText("в Figma"));

    expect(opened).toEqual([["https://figma.com/file/1", "_blank", "noopener,noreferrer"]]);
  });

  it("opens nothing when the text around it is clicked", async () => {
    describedBy(true);

    await userEvent.click(await screen.findByText(/Макет/));

    expect(opened).toEqual([]);
  });
});
