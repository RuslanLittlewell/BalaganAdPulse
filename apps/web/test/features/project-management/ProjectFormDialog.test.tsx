import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aClient, aProject, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectFormDialog } from "@/features/project-management/ui/ProjectFormDialog.js";

const acme = aClient({ id: "1", name: "Acme" });
const other = aClient({ id: "2", name: "Борода" });

function setup(ui = <ProjectFormDialog onClose={() => {}} />, clients = [acme, other]) {
  server.use(http.get("/api/clients", () => HttpResponse.json(clients)));
  return renderWithProviders(ui);
}

describe("ProjectFormDialog", () => {
  it("asks for exactly the four things a project is described by", async () => {
    setup();
    expect(screen.getByLabelText("Название проекта")).toBeInTheDocument();
    expect(await screen.findByLabelText("Клиент")).toBeInTheDocument();
    expect(screen.getByLabelText("Ниша")).toBeInTheDocument();
    expect(screen.getByLabelText("Бюджет / мес.")).toBeInTheDocument();
    expect(screen.getByLabelText("Логотип или картинка")).toHaveAttribute("accept", "image/*");
  });

  it("refuses a project with no name", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));
    expect(await screen.findByText("Введите название проекта")).toBeInTheDocument();
  });

  it("refuses a project with no client", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Название проекта"), "Летний запуск");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));
    expect(await screen.findByText("Выберите клиента")).toBeInTheDocument();
  });

  it("sends the name, the client and the numbers", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.post("/api/projects", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(aProject(sent as never), { status: 201 });
      }),
    );
    setup(<ProjectFormDialog clientId="1" onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText("Название проекта"), "  Летний запуск  ");
    await userEvent.type(screen.getByLabelText("Ниша"), "fitness");
    await userEvent.type(screen.getByLabelText("Бюджет / мес."), "1500");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(sent).toBeDefined());
    expect(sent).toMatchObject({
      clientId: "1",
      name: "Летний запуск",
      niche: "fitness",
      monthlyBudget: 1500,
    });
  });

  it("ignores keystrokes that would make the budget a non-number", async () => {
    setup();
    const budget = screen.getByLabelText("Бюджет / мес.");
    await userEvent.type(budget, "12a.5b");
    expect(budget).toHaveValue("12.5");
  });

  it("clears an emptied niche rather than storing a blank", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.patch("/api/projects/p1", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(aProject());
      }),
    );
    const project = aProject({ id: "p1", clientId: "1", niche: "fitness" });
    setup(<ProjectFormDialog project={project} onClose={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Ниша"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(sent).toBeDefined());
    expect(sent?.niche).toBeNull();
  });

  it("says where clients come from when there are none to pick", async () => {
    setup(<ProjectFormDialog onClose={() => {}} />, []);
    expect(await screen.findByText("Сначала заведите клиента в контактной книге"))
      .toBeInTheDocument();
  });

  it("offers no deletion while creating: there is nothing to delete yet", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });

  it("offers deletion while editing, behind a confirmation", async () => {
    setup(<ProjectFormDialog project={aProject({ id: "p1", clientId: "1" })} onClose={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Удалить" }));

    expect(await screen.findByRole("alertdialog", { name: "Удалить проект?" })).toBeInTheDocument();
  });

  it("deletes only once the confirmation is answered", async () => {
    let deleted = false;
    server.use(
      http.delete("/api/projects/p1", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDeleted = vi.fn();
    const onClose = vi.fn();
    setup(
      <ProjectFormDialog
        project={aProject({ id: "p1", clientId: "1" })}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(deleted).toBe(false);

    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(deleted).toBe(true));
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });
});
