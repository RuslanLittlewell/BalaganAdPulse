import { http as mock, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders, server } from "@test/shared/index.js";
import { TaskDescriptionEditor } from "@/features/task-management/index.js";

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
