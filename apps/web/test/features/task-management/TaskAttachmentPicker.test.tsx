import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";
import { collectImageIds } from "@/entities/task/index.js";

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const png = (name = "shot.png") => new File([PNG_BYTES], name, { type: "image/png" });

let uploads: number;
let sent: Record<string, unknown> | null;

beforeEach(() => {
  uploads = 0;
  sent = null;
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/task-images/:id", () => new HttpResponse(PNG_BYTES, { headers: { "Content-Type": "image/png" } })),
    mock.post("/api/task-images", () => {
      uploads += 1;
      return HttpResponse.json(
        { id: `image-${uploads}`, taskId: null, contentType: "image/png", bytes: PNG_BYTES.length },
        { status: 201 },
      );
    }),
    mock.patch("/api/tasks/:id", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...aTask(), ...sent });
    }),
  );
});

function setup() {
  renderWithProviders(<TaskFormDialog task={aTask({ projectId: "project-1" })} onClose={() => {}} />, { route: "/tasks" });
}

const paperclip = () => screen.findByRole("button", { name: "Прикрепить изображение" });

describe("attaching images with the paperclip", () => {
  it("uploads the chosen images, lists them and adds them to the description", async () => {
    const user = userEvent.setup();
    setup();
    await paperclip();

    await user.upload(screen.getByTestId("task-attachments-picker"), [png(), png("second.png")]);

    const attachments = screen.getByTestId("task-attachments");
    expect(await within(attachments).findByTestId("task-attachment-image-1")).toBeInTheDocument();
    expect(await within(attachments).findByTestId("task-attachment-image-2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(collectImageIds(sent?.description)).toEqual(["image-1", "image-2"]));
  });

  it("opens the file picker for images from the paperclip", async () => {
    const user = userEvent.setup();
    setup();
    const picker = screen.getByTestId("task-attachments-picker") as HTMLInputElement;
    const opened = vi.fn();
    picker.addEventListener("click", opened);

    await user.click(await paperclip());

    expect(opened).toHaveBeenCalled();
    expect(picker.accept).toBe("image/png,image/jpeg,image/webp,image/gif");
  });

  it("refuses a file that is not an image, and uploads nothing", async () => {
    const user = userEvent.setup({ applyAccept: false });
    setup();
    await paperclip();

    await user.upload(
      screen.getByTestId("task-attachments-picker"),
      new File(["%PDF"], "brief.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Можно загружать только PNG, JPEG, WebP и GIF");
    expect(uploads).toBe(0);
  });

  it("tells when the upload fails", async () => {
    const user = userEvent.setup();
    server.use(mock.post("/api/task-images", () => HttpResponse.json({ error: { message: "no" } }, { status: 500 })));
    setup();
    await paperclip();

    await user.upload(screen.getByTestId("task-attachments-picker"), png());

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить изображение");
  });
});
