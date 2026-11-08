import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog, TaskPreviewDialog } from "@/features/task-management/index.js";

const PDF_BYTES = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

const pdf = (name = "brief.pdf", size = PDF_BYTES.length) =>
  new File([size === PDF_BYTES.length ? PDF_BYTES : new Uint8Array(size)], name, { type: "application/pdf" });

const NAMES = ["Бриф.pdf", "Договор.pdf"];

let uploads: number;
let sent: Record<string, unknown> | null;
let deleted: string[];

beforeEach(() => {
  uploads = 0;
  sent = null;
  deleted = [];
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.post("/api/task-documents", () => {
      uploads += 1;
      return HttpResponse.json({ id: `doc-${uploads}`, taskId: null, name: NAMES[uploads - 1], bytes: PDF_BYTES.length }, { status: 201 });
    }),
    mock.delete("/api/task-documents/:id", ({ params }) => {
      deleted.push(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
    mock.get("/api/task-documents/:id", () => new HttpResponse(PDF_BYTES, { headers: { "Content-Type": "application/pdf" } })),
    mock.patch("/api/tasks/:id", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...aTask(), ...sent });
    }),
    mock.post("/api/tasks", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...aTask(), ...sent }, { status: 201 });
    }),
  );
});

function setup(task = aTask({ projectId: "project-1" })) {
  renderWithProviders(<TaskFormDialog task={task} onClose={() => {}} />, { route: "/tasks" });
}

const paperclip = () => screen.findByRole("button", { name: "Прикрепить PDF" });
const section = () => screen.getByRole("region", { name: "Документы" });

describe("attaching PDF documents to a task", () => {
  it("uploads the chosen PDFs, lists them with their sizes and sends their ids with the task", async () => {
    const user = userEvent.setup();
    setup();
    await paperclip();

    await user.upload(screen.getByTestId("task-documents-picker"), [pdf("Бриф.pdf"), pdf("Договор.pdf")]);

    expect(await within(section()).findByText("Бриф.pdf")).toBeInTheDocument();
    expect(within(section()).getByText("Договор.pdf")).toBeInTheDocument();
    expect(within(section()).getAllByText(/8 Б/)).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(sent?.documentIds).toEqual(["doc-1", "doc-2"]));
  });

  it("opens the file picker for PDF files from the paperclip", async () => {
    const user = userEvent.setup();
    setup();
    const picker = screen.getByTestId("task-documents-picker") as HTMLInputElement;
    const opened = vi.fn();
    picker.addEventListener("click", opened);

    await user.click(await paperclip());

    expect(opened).toHaveBeenCalled();
    expect(picker.accept).toBe("application/pdf,.pdf");
  });

  it("refuses a file that is not a PDF and uploads nothing", async () => {
    const user = userEvent.setup({ applyAccept: false });
    setup();
    await paperclip();

    await user.upload(screen.getByTestId("task-documents-picker"), new File(["x"], "notes.docx", { type: "application/msword" }));

    expect(await within(section()).findByRole("alert")).toHaveTextContent("Можно загружать только PDF");
    expect(uploads).toBe(0);
  });

  it("refuses a PDF over 20 MB and uploads nothing", async () => {
    const user = userEvent.setup();
    setup();
    await paperclip();

    await user.upload(screen.getByTestId("task-documents-picker"), pdf("huge.pdf", 21 * 1024 * 1024));

    expect(await within(section()).findByRole("alert")).toHaveTextContent("максимум 20 МБ");
    expect(uploads).toBe(0);
  });

  it("reports an upload the server refused", async () => {
    server.use(mock.post("/api/task-documents", () =>
      HttpResponse.json({ error: { message: "Only PDF documents can be uploaded" } }, { status: 400 })));
    const user = userEvent.setup();
    setup();
    await paperclip();

    await user.upload(screen.getByTestId("task-documents-picker"), pdf());

    expect(await within(section()).findByRole("alert")).toHaveTextContent("Only PDF documents can be uploaded");
  });

  it("stops at ten documents", async () => {
    const user = userEvent.setup();
    setup(aTask({ projectId: "project-1", documents: Array.from({ length: 10 }, (_, n) => ({ id: `d${n}`, name: `d${n}.pdf`, bytes: 10 })) }));

    expect(await paperclip()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent?.documentIds).toBeUndefined();
  });

  it("lists the documents a saved task holds, and sends no ids when none was added", async () => {
    const user = userEvent.setup();
    setup(aTask({ projectId: "project-1", documents: [{ id: "doc-9", name: "Смета.pdf", bytes: 2048 }] }));

    expect(await within(await screen.findByRole("region", { name: "Документы" })).findByText("Смета.pdf")).toBeInTheDocument();
    expect(section()).toHaveTextContent("2 КБ");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent?.documentIds).toBeUndefined();
  });

  it("removes a document through the API and drops it from the list", async () => {
    const user = userEvent.setup();
    setup(aTask({ projectId: "project-1", documents: [{ id: "doc-9", name: "Смета.pdf", bytes: 2048 }] }));

    await user.click(await screen.findByRole("button", { name: "Удалить документ: Смета.pdf" }));

    await waitFor(() => expect(deleted).toEqual(["doc-9"]));
    await waitFor(() => expect(within(section()).queryByText("Смета.pdf")).toBeNull());
  });

  it("opens a document in a new tab through the authenticated download", async () => {
    const user = userEvent.setup();
    const tab = { location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    URL.createObjectURL = vi.fn(() => "blob:pdf-1");
    URL.revokeObjectURL = vi.fn();
    setup(aTask({ projectId: "project-1", documents: [{ id: "doc-9", name: "Смета.pdf", bytes: 2048 }] }));

    await user.click(await screen.findByRole("button", { name: "Открыть документ: Смета.pdf" }));

    await waitFor(() => expect(tab.location.href).toBe("blob:pdf-1"));
    expect(open).toHaveBeenCalledWith("", "_blank");
    open.mockRestore();
  });

  it("says a document could not be opened and closes the empty tab", async () => {
    server.use(mock.get("/api/task-documents/:id", () => new HttpResponse(null, { status: 404 })));
    const user = userEvent.setup();
    const tab = { location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    setup(aTask({ projectId: "project-1", documents: [{ id: "doc-9", name: "Смета.pdf", bytes: 2048 }] }));

    await user.click(await screen.findByRole("button", { name: "Открыть документ: Смета.pdf" }));

    expect(await within(section()).findByRole("alert")).toHaveTextContent("Не удалось открыть документ");
    expect(tab.close).toHaveBeenCalled();
    open.mockRestore();
  });
});

describe("the documents of a task being read", () => {
  it("are listed in the preview without upload or remove controls", async () => {
    renderWithProviders(
      <TaskPreviewDialog task={aTask({ documents: [{ id: "doc-9", name: "Смета.pdf", bytes: 2048 }] })} onClose={() => {}} />,
      { route: "/tasks" },
    );

    const documents = await screen.findByRole("region", { name: "Документы" });
    expect(within(documents).getByText("Смета.pdf")).toBeInTheDocument();
    expect(within(documents).queryByRole("button", { name: /Удалить документ/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Прикрепить PDF" })).toBeNull();
  });
});
