import { useState } from "react";
import { http as mock, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders, server } from "@test/shared/index.js";
import { TaskDescriptionEditor } from "@/features/task-management/index.js";
import { TaskImage } from "@/features/task-management/ui/TaskImageNode.js";

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function imageFile(type = "image/png", size = PNG_BYTES.length) {
  const file = new File([PNG_BYTES], "shot.png", { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** ProseMirror's paste and drop handlers live on its own contenteditable node,
 * not on the wrapper that carries the test id. */
async function editorSurface(): Promise<Element> {
  const wrapper = await screen.findByTestId("task-description-editor");
  return await waitFor(() => {
    const editable = wrapper.querySelector("[contenteditable]");
    if (!editable) throw new Error("the editor has not mounted yet");
    return editable;
  });
}

function setup() {
  return renderWithProviders(
    <TaskDescriptionEditor value={null} onChange={() => {}} />,
    { route: "/tasks" },
  );
}

/** jsdom builds no clipboard payloads of its own, so the event carries one. */
function pasteFiles(target: Element, files: File[]) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { files, getData: () => "", types: files.length ? ["Files"] : ["text/plain"] },
  });
  target.dispatchEvent(event);
}

function dropFiles(target: Element, files: File[]) {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { files, getData: () => "", types: files.length ? ["Files"] : ["text/plain"] },
  });
  target.dispatchEvent(event);
}

describe("TaskDescriptionEditor", () => {
  it("ignores a file dropped outside the editor, and never navigates away", async () => {
    let uploaded = false;
    server.use(mock.post("/api/task-images", () => {
      uploaded = true;
      return HttpResponse.json({}, { status: 201 });
    }));
    setup();
    await editorSurface();

    dropFiles(document.body, [imageFile()]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(uploaded).toBe(false);
  });

  it("uploads an image pasted into it", async () => {
    let uploaded = false;
    server.use(mock.post("/api/task-images", () => {
      uploaded = true;
      return HttpResponse.json({ id: "image-1", taskId: null, contentType: "image/png", bytes: 8 }, { status: 201 });
    }));
    setup();

    pasteFiles(await editorSurface(), [imageFile()]);
    await waitFor(() => expect(uploaded).toBe(true));
  });

  it("uploads an image dropped onto it", async () => {
    let uploaded = false;
    server.use(mock.post("/api/task-images", () => {
      uploaded = true;
      return HttpResponse.json({ id: "image-1", taskId: null, contentType: "image/png", bytes: 8 }, { status: 201 });
    }));
    setup();

    // Dropped on the editor as a whole, which is where the handler lives.
    dropFiles(await screen.findByTestId("task-description-editor"), [imageFile()]);
    await waitFor(() => expect(uploaded).toBe(true));
  });

  it("uploads nothing when the paste is plain text", async () => {
    let uploaded = false;
    server.use(mock.post("/api/task-images", () => {
      uploaded = true;
      return HttpResponse.json({}, { status: 201 });
    }));
    setup();

    pasteFiles(await editorSurface(), []);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(uploaded).toBe(false);
  });

  it("refuses a file that is too large, and uploads nothing", async () => {
    let uploaded = false;
    server.use(mock.post("/api/task-images", () => {
      uploaded = true;
      return HttpResponse.json({}, { status: 201 });
    }));
    setup();

    pasteFiles(await editorSurface(), [imageFile("image/png", 11 * 1024 * 1024)]);
    expect(await screen.findByRole("status"))
      .toHaveTextContent("Изображение слишком большое, максимум 10 МБ");
    expect(uploaded).toBe(false);
  });

  it("refuses a type it does not accept, and uploads nothing", async () => {
    let uploaded = false;
    server.use(mock.post("/api/task-images", () => {
      uploaded = true;
      return HttpResponse.json({}, { status: 201 });
    }));
    setup();

    pasteFiles(await editorSurface(), [imageFile("image/tiff")]);
    expect(await screen.findByRole("status"))
      .toHaveTextContent("Можно загружать только PNG, JPEG, WebP и GIF");
    expect(uploaded).toBe(false);
  });

  it("reports an upload the API refused", async () => {
    server.use(mock.post("/api/task-images", () =>
      HttpResponse.json({ error: { message: "Недостаточно прав" } }, { status: 403 })));
    setup();

    pasteFiles(await editorSurface(), [imageFile()]);
    expect(await screen.findByRole("status")).toHaveTextContent("Недостаточно прав");
  });
});


describe("the editor's identity across renders", () => {
  /**
   * The reported bug: the first keystroke turned the value from null into a
   * document, and the editor was rebuilt whenever `value === null` changed. The
   * contenteditable element holding the caret was replaced mid-keystroke, so
   * the field lost focus on exactly the first character and never again.
   */
  it("keeps the same editable element when the value stops being empty", async () => {
    const { rerender } = render(
      <TaskDescriptionEditor value={null} onChange={() => {}} />,
    );
    const before = await editorSurface();

    rerender(
      <TaskDescriptionEditor
        value={{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }}
        onChange={() => {}}
      />,
    );

    expect(await editorSurface()).toBe(before);
  });

  it("keeps focus while the first character is typed", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<unknown | null>(null);
      return <TaskDescriptionEditor value={value} onChange={setValue} />;
    }
    render(<Harness />);
    const surface = await editorSurface();

    await user.click(surface);
    await user.keyboard("f");

    expect(await editorSurface()).toHaveFocus();
  });

  it("opens an existing description", async () => {
    render(
      <TaskDescriptionEditor
        value={{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "already here" }] }] }}
        onChange={() => {}}
      />,
    );
    expect(await screen.findByTestId("task-description-editor")).toHaveTextContent("already here");
  });
});


const withImages = (...imageIds: string[]) => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Смотри вложения" }] },
    ...imageIds.map((imageId) => ({ type: "taskImage", attrs: { imageId } })),
  ],
});

describe("images in the description", () => {
  beforeEach(() => {
    server.use(mock.get("/api/task-images/:id", () =>
      HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { "Content-Type": "image/png" } })));
  });

  /**
   * The picture itself belongs in the attachments block; the description keeps
   * a reference to it. A description full of inline images is unreadable at the
   * size a task dialog gives it, and the same bytes end up drawn twice.
   */
  it("shows each image as a numbered attachment link, not as a picture", async () => {
    renderWithProviders(
      <TaskDescriptionEditor value={withImages("image-1", "image-2")} onChange={() => {}} />,
      { route: "/tasks" },
    );

    expect(await screen.findByRole("button", { name: "Вложение 1" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Вложение 2" })).toBeInTheDocument();
    const editor = await screen.findByTestId("task-description-editor");
    expect(editor.querySelector("img")).toBeNull();
  });

  it("numbers by position, so the first image in the text is the first attachment", async () => {
    renderWithProviders(
      <TaskDescriptionEditor value={withImages("aaa", "bbb", "ccc")} onChange={() => {}} />,
      { route: "/tasks" },
    );

    const links = await screen.findAllByRole("button", { name: /^Вложение \d+$/ });
    expect(links.map((link) => link.textContent)).toEqual([
      "Вложение 1", "Вложение 2", "Вложение 3",
    ]);
  });

  it("opens the picture in a preview when the link is pressed", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TaskDescriptionEditor value={withImages("image-1")} onChange={() => {}} />,
      { route: "/tasks" },
    );

    await user.click(await screen.findByRole("button", { name: "Вложение 1" }));

    const preview = await screen.findByTestId("task-image-preview");
    expect(within(preview).getByRole("img", { name: "Вложение 1" })).toBeInTheDocument();
  });

  it("closes the preview again", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TaskDescriptionEditor value={withImages("image-1")} onChange={() => {}} />,
      { route: "/tasks" },
    );

    await user.click(await screen.findByRole("button", { name: "Вложение 1" }));
    await screen.findByTestId("task-image-preview");
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByTestId("task-image-preview")).not.toBeInTheDocument());
  });

  it("keeps the reference when the picture cannot be fetched", async () => {
    server.use(mock.get("/api/task-images/:id", () =>
      HttpResponse.json({ error: { message: "gone" } }, { status: 404 })));
    renderWithProviders(
      <TaskDescriptionEditor value={withImages("image-1")} onChange={() => {}} />,
      { route: "/tasks" },
    );

    // The link still names the attachment: the description must not lose the
    // fact that something was attached because storage is unreachable.
    expect(await screen.findByRole("button", { name: "Вложение 1" })).toBeInTheDocument();
  });
});


describe("the attachment link sits in the text", () => {
  beforeEach(() => {
    server.use(mock.get("/api/task-images/:id", () =>
      HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { "Content-Type": "image/png" } })));
  });

  const inline = {
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "до " },
        { type: "taskImage", attrs: { imageId: "image-1" } },
        { type: "text", text: " после" },
      ],
    }],
  };

  /**
   * jsdom computes no layout, so "does not break the line" is asserted
   * structurally: the node lives inside the paragraph alongside the text, and
   * its wrapper is a span. A block-level node could do neither — it would be
   * lifted out of the paragraph by the schema.
   */
  it("keeps the link inside the paragraph, between the words", async () => {
    renderWithProviders(
      <TaskDescriptionEditor value={inline} onChange={() => {}} />, { route: "/tasks" },
    );

    const editor = await screen.findByTestId("task-description-editor");
    const paragraph = await waitFor(() => {
      const found = editor.querySelector("p");
      if (!found?.querySelector("[data-task-image]")) throw new Error("not mounted yet");
      return found;
    });

    expect(paragraph.textContent).toContain("до");
    expect(paragraph.textContent).toContain("после");
    expect(paragraph.querySelector("[data-task-image]")!.tagName).toBe("SPAN");
  });

  /**
   * The schema itself, because the document it produces cannot be observed
   * here: ProseMirror reports changes from its own transactions, and jsdom's
   * contenteditable does not drive them, so no amount of simulated typing
   * makes the editor emit a document to inspect.
   */
  it("declares the node inline, which is what keeps it in the paragraph", () => {
    expect(TaskImage.config.inline).toBe(true);
    expect(TaskImage.config.group).toBe("inline");
  });

  // Descriptions saved before the node became inline hold it directly under the
  // document, where an inline node is not valid. They must still open.
  it("opens a description saved with the image as a block", async () => {
    renderWithProviders(
      <TaskDescriptionEditor
        value={{
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Старое описание" }] },
            { type: "taskImage", attrs: { imageId: "image-1" } },
          ],
        }}
        onChange={() => {}}
      />,
      { route: "/tasks" },
    );

    expect(await screen.findByRole("button", { name: "Вложение 1" })).toBeInTheDocument();
    expect(await screen.findByTestId("task-description-editor"))
      .toHaveTextContent("Старое описание");
  });
});

describe("the description's height", () => {
  it("scrolls inside 400px instead of growing without limit", async () => {
    setup();
    const surface = await editorSurface();
    // The editor grows with its content; past 400px it has to scroll, or a long
    // description pushes the dialog's own buttons out of reach.
    expect(surface.className).toContain("max-h-[400px]");
    expect(surface.className).toContain("overflow-y-auto");
  });
});
