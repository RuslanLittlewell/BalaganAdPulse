import { useState } from "react";
import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aClient, aProject, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectFormDialog } from "@/features/project-management/ui/ProjectFormDialog.js";
import { ContactBook } from "@/widgets/contact-book/ContactBook.js";

const acme = aClient({ id: "1", name: "Acme" });
const other = aClient({ id: "2", name: "Борода" });

function setup(ui = <ProjectFormDialog onClose={() => {}} />, clients = [acme, other]) {
  server.use(http.get("/api/clients", () => HttpResponse.json(clients)));
  return renderWithProviders(ui);
}

describe("ProjectFormDialog", () => {
  it("asks for exactly the things a project is described by", async () => {
    setup();
    expect(screen.getByLabelText("Название проекта")).toBeInTheDocument();
    expect(await screen.findByLabelText("Клиент")).toBeInTheDocument();
    expect(screen.getByLabelText("Валюта")).toBeInTheDocument();
    expect(screen.getByLabelText("Логотип или картинка")).toHaveAttribute("accept", "image/*");
    expect(screen.queryByLabelText("Ниша")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Бюджет / мес.")).not.toBeInTheDocument();
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

  it("sends the name and the client", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.post("/api/projects", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(aProject(sent as never), { status: 201 });
      }),
    );
    setup(<ProjectFormDialog clientId="1" onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText("Название проекта"), "  Летний запуск  ");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(sent).toBeDefined());
    expect(sent).toMatchObject({
      clientId: "1",
      name: "Летний запуск",
    });
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

    await userEvent.click(await screen.findByRole("button", { name: "Удалить" }));

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

    await userEvent.click(await screen.findByRole("button", { name: "Удалить" }));
    expect(deleted).toBe(false);

    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(deleted).toBe(true));
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("the currency a budget is stated in", () => {
  it("offers the four currencies", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByLabelText("Валюта"));

    for (const sign of ["BYN", "RUB", "USD", "EUR"]) {
      expect(await screen.findByRole("option", { name: new RegExp(sign) })).toBeInTheDocument();
    }
  });

  it("starts on the agency's own currency", async () => {
    setup();

    expect(await screen.findByLabelText("Валюта")).toHaveTextContent("BYN");
  });

  it("sends the currency chosen", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(http.post("/api/projects", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: "p1" }, { status: 201 });
    }));
    setup(<ProjectFormDialog clientId="1" onClose={() => {}} />);

    await user.type(await screen.findByLabelText("Название проекта"), "Стоматология");
    await user.click(screen.getByLabelText("Валюта"));
    await user.click(await screen.findByRole("option", { name: /USD/ }));
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ name: "Стоматология", budgetCurrency: "USD" });
  });

  it("opens an existing project on the currency it was stated in", async () => {
    setup(
      <ProjectFormDialog
        project={aProject({ id: "p1", budgetCurrency: "EUR" })}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByLabelText("Валюта")).toHaveTextContent("EUR");
  });
});

describe("a customer's project form", () => {
  const asCustomer = (role = "CLIENT") => server.use(http.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-9", name: "Клиент", email: "client@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role,
    clientIds: ["1"],
  })));

  it("fixes the client to their own, offers no client creation, and creates the project for it", async () => {
    asCustomer("CLIENT_ADMIN");
    let sent: Record<string, unknown> | undefined;
    server.use(http.post("/api/projects", async ({ request }) => {
      sent = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(aProject(sent as never), { status: 201 });
    }));
    setup(<ProjectFormDialog onClose={() => {}} />, [acme]);

    await waitFor(() => expect(screen.getByLabelText("Клиент")).toHaveTextContent("Acme"));
    expect(screen.getByLabelText("Клиент")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Новый клиент" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Название проекта"), "Имплантация");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(sent).toMatchObject({ clientId: "1", name: "Имплантация" }));
  });

  it("offers editing without deletion", async () => {
    asCustomer();
    setup(<ProjectFormDialog project={aProject({ id: "p1", clientId: "1" })} onClose={() => {}} />, [acme]);

    expect(await screen.findByRole("button", { name: "Сохранить" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Клиент")).toBeDisabled());
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });
});

describe("creating a client from the project form", () => {
  function clientsThatGrow() {
    const clients = [acme, other];
    server.use(
      http.get("/api/clients", () => HttpResponse.json(clients)),
      http.post("/api/clients", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        const created = aClient({ id: "3", name: body.name });
        clients.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );
  }

  const asRole = (role: string) => server.use(http.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role,
    clientIds: [],
  })));

  it("creates a client beside the select, selects it and creates the project for it", async () => {
    clientsThatGrow();
    let sent: Record<string, unknown> | undefined;
    server.use(http.post("/api/projects", async ({ request }) => {
      sent = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(aProject(sent as never), { status: 201 });
    }));
    renderWithProviders(<ProjectFormDialog onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText("Название проекта"), "Летний запуск");
    await userEvent.click(await screen.findByRole("button", { name: "Новый клиент" }));
    const clientDialog = await screen.findByRole("dialog", { name: "Новый клиент" });
    await userEvent.type(within(clientDialog).getByLabelText("Имя"), "Ромашка");
    await userEvent.click(within(clientDialog).getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Новый клиент" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText("Клиент")).toHaveTextContent("Ромашка"));
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(sent).toMatchObject({ clientId: "3", name: "Летний запуск" }));
  });

  it("keeps the chosen client when creating one is cancelled", async () => {
    clientsThatGrow();
    renderWithProviders(<ProjectFormDialog clientId="1" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByLabelText("Клиент")).toHaveTextContent("Acme"));
    await userEvent.click(screen.getByRole("button", { name: "Новый клиент" }));
    const clientDialog = await screen.findByRole("dialog", { name: "Новый клиент" });
    await userEvent.click(within(clientDialog).getByRole("button", { name: "Отмена" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Новый клиент" })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Новый проект" })).toBeInTheDocument();
    expect(screen.getByLabelText("Клиент")).toHaveTextContent("Acme");
  });

  it("offers no client creation to a member who may not create clients", async () => {
    clientsThatGrow();
    asRole("GUEST");
    renderWithProviders(<ProjectFormDialog project={aProject({ id: "p1", clientId: "1" })} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByLabelText("Клиент")).toHaveTextContent("Acme"));
    expect(screen.queryByRole("button", { name: "Новый клиент" })).not.toBeInTheDocument();
  });

  it("lists the created client in the contact book", async () => {
    clientsThatGrow();
    function Host() {
      const [book, setBook] = useState(false);
      return book
        ? <ContactBook open onClose={() => {}} />
        : <ProjectFormDialog onClose={() => setBook(true)} />;
    }
    renderWithProviders(<Host />);

    await userEvent.click(await screen.findByRole("button", { name: "Новый клиент" }));
    const clientDialog = await screen.findByRole("dialog", { name: "Новый клиент" });
    await userEvent.type(within(clientDialog).getByLabelText("Имя"), "Ромашка");
    await userEvent.click(within(clientDialog).getByRole("button", { name: "Создать" }));
    await waitFor(() => expect(screen.getByLabelText("Клиент")).toHaveTextContent("Ромашка"));
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));

    const list = await screen.findByTestId("contact-book-list");
    expect(await within(list).findByRole("button", { name: /Ромашка/ })).toBeInTheDocument();
  });
});
