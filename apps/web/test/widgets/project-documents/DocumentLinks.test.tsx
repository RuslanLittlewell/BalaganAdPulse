import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@test/shared/index.js";
import { DocumentEditor } from "@/widgets/project-documents/DocumentEditor.js";

const linked = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Бриф " },
        { type: "text", text: "в Notion", marks: [{ type: "link", attrs: { href: "https://notion.so/brief" } }] },
      ],
    },
  ],
};

describe("a link in a project document", () => {
  let opened: unknown[][];

  beforeEach(() => {
    opened = [];
    vi.spyOn(window, "open").mockImplementation((...args: unknown[]) => {
      opened.push(args);
      return null;
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([true, false])("opens in a new tab when clicked, editable: %s", async (editable) => {
    renderWithProviders(<DocumentEditor value={linked} editable={editable} onChange={() => {}} />, { route: "/projects" });

    await userEvent.click(await screen.findByText("в Notion"));

    expect(opened).toEqual([["https://notion.so/brief", "_blank", "noopener,noreferrer"]]);
  });
});
