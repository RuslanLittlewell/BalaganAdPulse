import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { TaskDescriptionEditor } from "@/features/task-management/index.js";

const document = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Переписать заголовки" }] },
    { type: "taskImage", attrs: { imageId: "img-1" } },
  ],
};

beforeEach(() => {
  server.use(mock.get("/api/task-images/:id", () =>
    HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { "Content-Type": "image/png" } })));
});

describe("a description that cannot be edited", () => {
  it("renders the document it is given", async () => {
    renderWithProviders(
      <TaskDescriptionEditor value={document} onChange={() => {}} editable={false} />,
      { route: "/projects" },
    );

    expect(await screen.findByText("Переписать заголовки")).toBeInTheDocument();
  });

  it("renders the images the description references", async () => {
    renderWithProviders(
      <TaskDescriptionEditor value={document} onChange={() => {}} editable={false} />,
      { route: "/projects" },
    );

    expect(await screen.findByText(/Вложение 1/)).toBeInTheDocument();
  });

  it("refuses typing", async () => {
    const user = userEvent.setup();
    const changes: unknown[] = [];
    renderWithProviders(
      <TaskDescriptionEditor value={document} onChange={(v) => changes.push(v)} editable={false} />,
      { route: "/projects" },
    );
    const surface = await screen.findByLabelText("Описание");

    expect(surface).toHaveAttribute("contenteditable", "false");
    await user.click(surface);
    await user.keyboard("нет");

    expect(changes).toEqual([]);
  });

  it("ignores a dropped image", async () => {
    let uploaded = false;
    server.use(mock.post("/api/task-images", () => {
      uploaded = true;
      return HttpResponse.json({ id: "img-2" }, { status: 201 });
    }));
    renderWithProviders(
      <TaskDescriptionEditor value={document} onChange={() => {}} editable={false} />,
      { route: "/projects" },
    );
    await screen.findByText("Переписать заголовки");

    const file = new File([new Uint8Array([1])], "shot.png", { type: "image/png" });
    const surface = screen.getByTestId("task-description-editor").parentElement!;
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: { files: [file], types: ["Files"] } });
    surface.dispatchEvent(drop);

    await waitFor(() => expect(uploaded).toBe(false));
  });

  it("still edits when it is not asked to be read-only", async () => {
    renderWithProviders(
      <TaskDescriptionEditor value={document} onChange={() => {}} />,
      { route: "/projects" },
    );

    expect(await screen.findByLabelText("Описание")).toHaveAttribute("contenteditable", "true");
  });
});
