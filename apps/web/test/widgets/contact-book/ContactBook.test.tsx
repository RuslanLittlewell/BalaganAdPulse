import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { aClient, renderWithProviders, server } from "@test/shared/index.js";
import { ContactBook } from "@/widgets/contact-book/ContactBook.js";

const acme = aClient({
  fullName: "Иван Петров",
  organization: "ООО «Акме»",
  unp: "191234567",
  phone: "+375 29 123-45-67",
  telegram: "@acme",
  email: "ivan@acme.by",
  website: "acme.by",
});

const bare = aClient({ id: "2", name: "Борода" });

function withClients(clients: unknown[]) {
  server.use(http.get("/api/clients", () => HttpResponse.json(clients)));
}

async function open(clients: unknown[] = [acme, bare]) {
  withClients(clients);
  renderWithProviders(<ContactBook open onClose={() => {}} />);
  return screen.findByRole("dialog", { name: "Контактная книга" });
}

describe("ContactBook", () => {
  it("lists every client", async () => {
    await open();
    expect(await screen.findByRole("button", { name: /Acme/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Борода/ })).toBeInTheDocument();
  });

  it("shows the first client's details without a click", async () => {
    const dialog = await open();
    expect(await within(dialog).findByText("Иван Петров")).toBeInTheDocument();
    expect(within(dialog).getByText("191234567")).toBeInTheDocument();
    expect(within(dialog).getByText("ООО «Акме»")).toBeInTheDocument();
  });

  it("names every contact field", async () => {
    const dialog = await open();
    for (const label of ["Полное имя", "Название организации", "УНП", "Телефон", "Телеграм", "Почта", "Сайт"]) {
      expect(await within(dialog).findByText(label), label).toBeInTheDocument();
    }
  });

  it("swaps the right pane when another client is chosen", async () => {
    const dialog = await open();
    expect(await within(dialog).findByText("Иван Петров")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Борода/ }));

    expect(within(dialog).queryByText("Иван Петров")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Борода" })).toBeInTheDocument();
  });

  it("makes the reachable details actionable", async () => {
    const dialog = await open([acme]);
    expect(await within(dialog).findByRole("link", { name: "ivan@acme.by" }))
      .toHaveAttribute("href", "mailto:ivan@acme.by");
    expect(within(dialog).getByRole("link", { name: "@acme" }))
      .toHaveAttribute("href", "https://t.me/acme");
    expect(within(dialog).getByRole("link", { name: "acme.by" }))
      .toHaveAttribute("href", "https://acme.by");
    expect(within(dialog).getByRole("link", { name: "+375 29 123-45-67" }))
      .toHaveAttribute("href", "tel:+375291234567");
  });

  it("shows a dash for a detail the client has not given", async () => {
    const dialog = await open([bare]);
    expect(await within(dialog).findByRole("heading", { name: "Борода" })).toBeInTheDocument();
    expect(within(dialog).getAllByText("—")).toHaveLength(7);
  });

  it("says so when there are no clients at all", async () => {
    await open([]);
    expect(await screen.findByText("Клиентов пока нет")).toBeInTheDocument();
  });
});

describe("ContactBook editing", () => {
  it("has no pencil or plus while a form is open", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));

    expect(screen.queryByRole("button", { name: "Редактировать контакт" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Новый контакт" })).not.toBeInTheDocument();
  });

  it("opens the pencil on the selected contact, prefilled", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));

    const form = screen.getByRole("form", { name: "Редактировать контакт" });
    expect(within(form).getByLabelText("Клиент")).toHaveValue("Acme");
    expect(within(form).getByLabelText("Полное имя")).toHaveValue("Иван Петров");
    expect(within(form).getByLabelText("УНП")).toHaveValue("191234567");
  });

  it("saves an edit and returns to the details", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.patch("/api/clients/1", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...acme, ...sent });
      }),
    );
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));

    const phone = screen.getByLabelText("Телефон");
    await userEvent.clear(phone);
    await userEvent.type(phone, "+375 44 000-00-00");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("button", { name: "Редактировать контакт" })).toBeInTheDocument();
    expect(sent).toMatchObject({ phone: "+375 44 000-00-00", unp: "191234567" });
  });

  it("sends null for a field the user emptied, so the server clears it", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      http.patch("/api/clients/1", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...acme, unp: null });
      }),
    );
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));
    await userEvent.clear(screen.getByLabelText("УНП"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await screen.findByRole("button", { name: "Редактировать контакт" });
    expect(sent?.unp).toBeNull();
  });

  it("opens an empty form on the plus", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Новый контакт" }));

    const form = screen.getByRole("form", { name: "Новый контакт" });
    expect(within(form).getByLabelText("Клиент")).toHaveValue("");
    expect(within(form).getByLabelText("Полное имя")).toHaveValue("");
    expect(within(form).getByRole("button", { name: "Создать" })).toBeInTheDocument();
  });

  it("creates a contact and shows it", async () => {
    await open();
    server.use(
      http.post("/api/clients", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...bare, id: "3", ...body }, { status: 201 });
      }),
      http.get("/api/clients", () =>
        HttpResponse.json([acme, bare, { ...bare, id: "3", name: "Новый" }])),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Новый контакт" }));
    await userEvent.type(screen.getByLabelText("Клиент"), "Новый");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByRole("heading", { name: "Новый" })).toBeInTheDocument();
  });

  it("refuses to create a contact with no name", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Новый контакт" }));
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Введите имя")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Новый контакт" })).toBeInTheDocument();
  });

  it("drops an edit when another contact is chosen", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));
    await userEvent.type(screen.getByLabelText("Полное имя"), " лишнее");

    await userEvent.click(screen.getByRole("button", { name: /Борода/ }));

    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Борода" })).toBeInTheDocument();
  });

  it("returns to the details on cancel", async () => {
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Редактировать контакт" }));
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByText("Иван Петров")).toBeInTheDocument();
  });
});

const employeeInvite = {
  id: "invite-1", code: "ABCDEFGH", registrationType: "EMPLOYEE", role: "MANAGER",
  projectIds: ["project-1"], email: null, expiresAt: null, revokedAt: null, usedAt: null,
  status: "PENDING", registrationUrl: "/regustration/ABCDEFGH",
  createdAt: "2026-09-01T00:00:00.000Z",
};

const member = {
  id: "membership-2", userId: "user-2", name: "Мария", email: "maria@acme.by",
  image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-08-31T10:00:00.000Z",
};

function withDirectory() {
  server.use(
    http.get("/api/clients", () => HttpResponse.json([acme, bare])),
    http.get("/api/members", () => HttpResponse.json([member])),
    http.get("/api/projects", () => HttpResponse.json([
      { id: "project-1", clientId: "1", name: "Летний запуск", niche: "Перформанс",
        monthlyBudget: null, budgetCurrency: "BYN", priority: "NEW", image: "data:image/png;base64,AAA",
        avatarPath: null, position: 0, createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z" },
      { id: "project-2", clientId: "1", name: "Второй проект", niche: null,
        monthlyBudget: null, budgetCurrency: "BYN", priority: "NEW", image: null,
        avatarPath: null, position: 1, createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z" },
    ])),
    http.get("/api/invites", () => HttpResponse.json([employeeInvite])),
  );
}

describe("choosing which directory to show", () => {
  it("opens on clients, as it always did", async () => {
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);

    expect(await screen.findByRole("button", { name: /Acme/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Мария/ })).not.toBeInTheDocument();
  });

  describe("who the employee directory lists", () => {
    const asMe = (userId: string) => server.use(http.get("/api/auth/me", () =>
      HttpResponse.json({
        user: { id: userId, name: "Я", email: "me@acme.by", image: null },
        organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
        role: "ADMIN",
        clientIds: [],
      })));

    it("lists colleagues and not the reader", async () => {
      const user = userEvent.setup();
      withDirectory();
      asMe("user-me");
      server.use(http.get("/api/members", () => HttpResponse.json([
        { ...member, id: "m-me", userId: "user-me", name: "Я" },
        { ...member, id: "m-2", userId: "user-2", name: "Мария" },
      ])));
      renderWithProviders(<ContactBook open onClose={() => {}} />);
      await screen.findByRole("button", { name: /Acme/ });

      await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

      expect(await screen.findByRole("button", { name: /Мария/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Я/ })).toBeNull();
    });

    it("says there is nobody when the reader is the only member", async () => {
      const user = userEvent.setup();
      withDirectory();
      asMe("user-me");
      server.use(http.get("/api/members", () => HttpResponse.json([
        { ...member, id: "m-me", userId: "user-me", name: "Я" },
      ])));
      renderWithProviders(<ContactBook open onClose={() => {}} />);
      await screen.findByRole("button", { name: /Acme/ });

      await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

      expect(await screen.findByText("Сотрудников пока нет")).toBeInTheDocument();
    });
  });

  describe("an employee's reach", () => {
    const withAccess = (grants: unknown[]) => server.use(
      http.get("/api/members", () => HttpResponse.json([member])),
      http.get("/api/members/:id/access", () => HttpResponse.json(grants)),
    );

    async function openEmployee(user: ReturnType<typeof userEvent.setup>) {
      renderWithProviders(<ContactBook open onClose={() => {}} />);
      await screen.findByRole("button", { name: /Acme/ });
      await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
      await user.click(await screen.findByRole("button", { name: /Мария/ }));
    }

    it("lists the projects they reach", async () => {
      const user = userEvent.setup();
      withDirectory();
      withAccess([{ id: "g1", clientId: "1", projectId: "project-1" }]);

      await openEmployee(user);

      expect(await screen.findByTestId("employee-access")).toHaveTextContent("Летний запуск");
    });

    it("shows a client-wide grant as covering the client, with nothing to remove", async () => {
      const user = userEvent.setup();
      withDirectory();
      withAccess([{ id: "g1", clientId: "1", projectId: null }]);

      await openEmployee(user);

      const access = await screen.findByTestId("employee-access");
      expect(access).toHaveTextContent("Acme");
      expect(within(access).queryByRole("button", { name: /Убрать/ })).toBeNull();
    });

    it("says so when they reach nothing", async () => {
      const user = userEvent.setup();
      withDirectory();
      withAccess([]);

      await openEmployee(user);

      expect(await screen.findByText("Проекты не назначены")).toBeInTheDocument();
    });

    it("shows each granted project with its picture", async () => {
      const user = userEvent.setup();
      withDirectory();
      withAccess([{ id: "g1", clientId: "1", projectId: "project-1" }]);

      await openEmployee(user);

      const access = await screen.findByTestId("employee-access");
      expect(access).toHaveTextContent("Летний запуск");
      expect(within(access).getByRole("img", { name: "Летний запуск" })).toBeInTheDocument();
    });

    it("grants a project, sending the whole set back", async () => {
      const user = userEvent.setup();
      let body: { grants?: unknown[] } | null = null;
      withDirectory();
      withAccess([{ id: "g1", clientId: "1", projectId: "project-1" }]);
      server.use(http.put("/api/members/:id/access", async ({ request }) => {
        body = await request.json() as { grants?: unknown[] };
        return HttpResponse.json([]);
      }));

      await openEmployee(user);
      await user.click(await screen.findByLabelText("Добавить проект"));
      await user.click(await screen.findByRole("option", { name: /Второй проект/ }));

      await waitFor(() => expect(body).not.toBeNull());
      expect(body!.grants).toEqual([
        { clientId: "1", projectId: "project-1" },
        { clientId: "1", projectId: "project-2" },
      ]);
    });

    it("removes a project, sending what is left", async () => {
      const user = userEvent.setup();
      let body: { grants?: unknown[] } | null = null;
      withDirectory();
      withAccess([
        { id: "g1", clientId: "1", projectId: "project-1" },
        { id: "g2", clientId: "1", projectId: "project-2" },
      ]);
      server.use(http.put("/api/members/:id/access", async ({ request }) => {
        body = await request.json() as { grants?: unknown[] };
        return HttpResponse.json([]);
      }));

      await openEmployee(user);
      await user.click(await screen.findByRole("button", { name: "Убрать Летний запуск" }));
      await user.click(await screen.findByRole("button", { name: "Убрать проект" }));

      await waitFor(() => expect(body).not.toBeNull());
      expect(body!.grants).toEqual([{ clientId: "1", projectId: "project-2" }]);
    });

    it("names the project in the question it asks", async () => {
      const user = userEvent.setup();
      withDirectory();
      withAccess([{ id: "g1", clientId: "1", projectId: "project-1" }]);

      await openEmployee(user);
      await user.click(await screen.findByRole("button", { name: "Убрать Летний запуск" }));

      expect(await screen.findByRole("alertdialog")).toHaveTextContent("Летний запуск");
    });

    it("changes nothing when the question is declined", async () => {
      const user = userEvent.setup();
      let asked = false;
      withDirectory();
      withAccess([{ id: "g1", clientId: "1", projectId: "project-1" }]);
      server.use(http.put("/api/members/:id/access", () => {
        asked = true;
        return HttpResponse.json([]);
      }));

      await openEmployee(user);
      await user.click(await screen.findByRole("button", { name: "Убрать Летний запуск" }));
      await user.click(await screen.findByRole("button", { name: "Отмена" }));

      expect(asked).toBe(false);
      expect(await screen.findByTestId("employee-access")).toHaveTextContent("Летний запуск");
    });

    it("offers no control to somebody who may not administer members", async () => {
      const user = userEvent.setup();
      withDirectory();
      withAccess([{ id: "g1", clientId: "1", projectId: "project-1" }]);
      server.use(http.get("/api/auth/me", () => HttpResponse.json({
        user: { id: "u1", name: "Пётр", email: "petr@acme.by", image: null },
        organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
        role: "MANAGER",
        clientIds: ["1"],
      })));

      await openEmployee(user);

      expect(await screen.findByTestId("employee-access")).toHaveTextContent("Летний запуск");
      expect(screen.queryByLabelText("Добавить проект")).toBeNull();
      expect(screen.queryByRole("button", { name: /Убрать/ })).toBeNull();
    });
  });

  describe("where outstanding invitations are listed", () => {
    it("shows none under either directory", async () => {
      const user = userEvent.setup();
      withDirectory();
      renderWithProviders(<ContactBook open onClose={() => {}} />);

      await screen.findByRole("button", { name: /Acme/ });
      expect(screen.queryByText("Приглашения")).toBeNull();

      await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
      expect(screen.queryByText("Приглашения")).toBeNull();
    });

    it("shows them in the dialog that makes one", async () => {
      const user = userEvent.setup();
      withDirectory();
      renderWithProviders(<ContactBook open onClose={() => {}} />);
      await screen.findByRole("button", { name: /Acme/ });

      await user.click(screen.getByRole("button", { name: "Пригласить клиента" }));

      const dialog = await screen.findByRole("dialog", { name: "Пригласить клиента" });
      expect(within(dialog).getByText("Приглашения")).toBeInTheDocument();
    });
  });

  it("keeps a minimum height, so choosing between people does not resize it", async () => {
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);

    const dialog = await screen.findByRole("dialog", { name: "Контактная книга" });
    expect(dialog.className).toContain("min-h-[550px]");
  });

  it("lays an employee's fields out the way a client's are", async () => {
    const user = userEvent.setup();
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });

    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
    await user.click(await screen.findByRole("button", { name: /Мария/ }));

    const details = await screen.findByTestId("employee-details");
    expect(details.className).toContain("divide-y");
    expect(within(details).getByText("Почта").className).toContain("uppercase");
  });

  it("shows how to reach each employee", async () => {
    const user = userEvent.setup();
    withDirectory();
    server.use(http.get("/api/members", () => HttpResponse.json([
      { ...member, id: "membership-2", name: "Мария", email: "maria@acme.by",
        phone: "+375299998877", telegram: "@maria" },
    ])));
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });

    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
    await user.click(await screen.findByRole("button", { name: /Мария/ }));

    const details = await screen.findByTestId("employee-details");
    expect(within(details).getByText("+375299998877")).toBeInTheDocument();
    expect(within(details).getByText("@maria")).toBeInTheDocument();
  });

  it("switches to the employees pane", async () => {
    const user = userEvent.setup();
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });

    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

    expect(await screen.findByRole("button", { name: /Мария/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Acme/ })).not.toBeInTheDocument();
  });

  describe("what a customer's contact book is", () => {
    const asPrincipal = (role = "CLIENT_ADMIN") => server.use(
      http.get("/api/auth/me", () => HttpResponse.json({
        user: { id: "u1", name: "Иван", email: "ivan@acme.by", image: null },
        organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
        role,
        clientIds: ["1"],
      })),
      http.get("/api/members", () => HttpResponse.json([
        { ...member, id: "m-1", name: "Иван Петров", role: "CLIENT_ADMIN" },
        { ...member, id: "m-2", name: "Мария Сидорова", role: "CLIENT" },
      ])),
    );

    it("shows how to reach each of them", async () => {
      withDirectory();
      server.use(
        http.get("/api/auth/me", () => HttpResponse.json({
          user: { id: "u1", name: "Иван", email: "ivan@acme.by", image: null },
          organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
          role: "CLIENT_ADMIN",
          clientIds: ["1"],
        })),
        http.get("/api/members", () => HttpResponse.json([
          { ...member, id: "m-1", name: "Иван Петров", email: "ivan@acme.by",
            phone: "+375291112233", telegram: "@ivan", role: "CLIENT_ADMIN" },
          { ...member, id: "m-2", name: "Мария Сидорова", email: "maria@acme.by",
            phone: null, telegram: null, role: "CLIENT" },
        ])),
      );
      renderWithProviders(<ContactBook open onClose={() => {}} />);

      const row = await screen.findByTestId("company-person-m-1");
      expect(within(row).getByText("ivan@acme.by")).toBeInTheDocument();
      expect(within(row).getByText("+375291112233")).toBeInTheDocument();
      expect(within(row).getByText("@ivan")).toBeInTheDocument();

      const without = screen.getByTestId("company-person-m-2");
      expect(within(without).getAllByText("—")).toHaveLength(2);
    });

    it("lists the company's people straight away", async () => {
      withDirectory();
      asPrincipal();
      renderWithProviders(<ContactBook open onClose={() => {}} />);

      expect(await screen.findByText("Иван Петров")).toBeInTheDocument();
      expect(screen.getByText("Мария Сидорова")).toBeInTheDocument();
    });

    it("shows no contact card and no client selector", async () => {
      withDirectory();
      asPrincipal();
      renderWithProviders(<ContactBook open onClose={() => {}} />);

      await screen.findByText("Иван Петров");
      expect(screen.queryByText("НАЗВАНИЕ ОРГАНИЗАЦИИ")).toBeNull();
      expect(screen.queryByRole("button", { name: /Acme/ })).toBeNull();
    });

    it("invites through the ordinary dialog", async () => {
      const user = userEvent.setup();
      withDirectory();
      asPrincipal();
      let body: Record<string, unknown> | null = null;
      server.use(http.post("/api/invites", async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { ...employeeInvite, id: "invite-new", registrationUrl: "/regustration/NEWCODE1" },
          { status: 201 },
        );
      }));
      renderWithProviders(<ContactBook open onClose={() => {}} />);

      await user.click(await screen.findByRole("button", { name: "Пригласить в компанию" }));
      expect(await screen.findByRole("dialog", { name: "Пригласить в компанию" }))
        .toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Создать приглашение" }));

      await waitFor(() => expect(body).not.toBeNull());
      expect(body).toMatchObject({ registrationType: "CLIENT_STAFF", clientId: "1" });
      expect(await screen.findByText(/\/regustration\/NEWCODE1$/)).toBeInTheDocument();
    });

    it("offers one invite control, not two", async () => {
      withDirectory();
      asPrincipal();
      renderWithProviders(<ContactBook open onClose={() => {}} />);

      await screen.findByText("Иван Петров");
      expect(screen.queryByRole("button", { name: "Пригласить клиента" })).toBeNull();
      expect(screen.getAllByRole("button", { name: "Пригласить в компанию" })).toHaveLength(1);
    });

    it("offers an ordinary customer no invite control at all", async () => {
      withDirectory();
      asPrincipal("CLIENT");
      renderWithProviders(<ContactBook open onClose={() => {}} />);

      await screen.findByText("Иван Петров");
      expect(screen.queryByRole("button", { name: "Пригласить в компанию" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Пригласить клиента" })).toBeNull();
    });

    it("gives the client list room for a full name", async () => {
      withDirectory();
      renderWithProviders(<ContactBook open onClose={() => {}} />);
      await screen.findByRole("button", { name: /Acme/ });

      const columns = screen.getByTestId("contact-book-columns");
      expect(columns.className).toContain("minmax(14rem,");
    });

  it("leaves the agency's own contact book as it was", async () => {
      withDirectory();
      renderWithProviders(<ContactBook open onClose={() => {}} />);

      expect(await screen.findByRole("button", { name: /Acme/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Пригласить клиента" })).toBeInTheDocument();
    });
  });

  it("offers a customer no employees pane", async () => {
    withDirectory();
    server.use(http.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "u1", name: "Иван", email: "ivan@acme.by", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "CLIENT_ADMIN",
      clientIds: ["1"],
    })));
    renderWithProviders(<ContactBook open onClose={() => {}} />);

    await screen.findByRole("heading", { name: "Контактная книга" });
    expect(screen.queryByRole("tab", { name: "Сотрудники" })).toBeNull();
  });

  it("still offers it to the agency", async () => {
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);

    expect(await screen.findByRole("tab", { name: "Сотрудники" })).toBeInTheDocument();
  });

  it("carries no people block on the client card", async () => {
    withDirectory();
    server.use(http.get("/api/members", () => HttpResponse.json([
      { ...member, id: "m-1", name: "Совсем Другой", role: "CLIENT_ADMIN" },
    ])));
    renderWithProviders(<ContactBook open onClose={() => {}} />);

    await userEvent.click(await screen.findByRole("button", { name: /Acme/ }));

    expect(screen.queryByText("Люди клиента")).toBeNull();
    expect(screen.queryByRole("button", { name: "Пригласить в компанию" })).toBeNull();
    expect(screen.queryByText("Совсем Другой")).toBeNull();
  });

  it("shows no customer among the employees", async () => {
    const user = userEvent.setup();
    withDirectory();
    server.use(http.get("/api/members", ({ request }) => {
      const staffOnly = new URL(request.url).searchParams.get("kind") === "staff";
      return HttpResponse.json(staffOnly ? [member] : [member, {
        ...member, id: "membership-9", userId: "user-9", name: "Заказчик", role: "CLIENT",
      }]);
    }));
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });

    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

    expect(await screen.findByRole("button", { name: /Мария/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Заказчик/ })).not.toBeInTheDocument();
  });

  it("goes back to the clients pane", async () => {
    const user = userEvent.setup();
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });

    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
    await screen.findByRole("button", { name: /Мария/ });
    await user.click(screen.getByRole("tab", { name: "Клиенты" }));

    expect(await screen.findByRole("button", { name: /Acme/ })).toBeInTheDocument();
  });
});

describe("inviting from the contact book", () => {
  it("lists the pending invitations of the kind it makes", async () => {
    const user = userEvent.setup();
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));

    expect(await screen.findByText(`${window.location.origin}/regustration/ABCDEFGH`))
      .toBeInTheDocument();
  });

  it("creates an employee invitation with a role and the chosen projects", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    withDirectory();
    server.use(http.post("/api/invites", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json(employeeInvite, { status: 201 });
    }));
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));
    const form = await screen.findByRole("dialog", { name: "Пригласить сотрудника" });
    await user.click(await within(form).findByRole("checkbox", { name: "Летний запуск" }));
    await user.click(within(form).getByRole("button", { name: "Создать приглашение" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      registrationType: "EMPLOYEE", role: "MANAGER", projectIds: ["project-1"],
    });
  });

  it("refuses an employee invitation with no project chosen", async () => {
    const user = userEvent.setup();
    let posted = false;
    withDirectory();
    server.use(http.post("/api/invites", () => {
      posted = true;
      return HttpResponse.json(employeeInvite, { status: 201 });
    }));
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));
    const form = await screen.findByRole("dialog", { name: "Пригласить сотрудника" });
    await user.click(within(form).getByRole("button", { name: "Создать приглашение" }));

    expect(await screen.findByText("Выберите хотя бы один проект")).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("creates a client invitation with no role and no projects", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    withDirectory();
    server.use(http.post("/api/invites", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json(
        { ...employeeInvite, registrationType: "CLIENT", role: null, projectIds: [] },
        { status: 201 },
      );
    }));
    renderWithProviders(<ContactBook open onClose={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "Пригласить клиента" }));
    const form = await screen.findByRole("dialog", { name: "Пригласить клиента" });
    await user.click(within(form).getByRole("button", { name: "Создать приглашение" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ registrationType: "CLIENT" });
  });

  it("revokes a pending invitation", async () => {
    const user = userEvent.setup();
    let revoked = false;
    withDirectory();
    server.use(http.delete("/api/invites/:id", () => {
      revoked = true;
      return new HttpResponse(null, { status: 204 });
    }));
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));

    await user.click(await screen.findByRole("button", { name: "Отозвать ABCDEFGH" }));

    await waitFor(() => expect(revoked).toBe(true));
  });

  it("offers the whole registration link to copy, not just the code", async () => {
    const user = userEvent.setup();
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } },
    });
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));

    await user.click(await screen.findByRole("button", { name: "Скопировать ссылку" }));

    expect(written).toEqual([`${window.location.origin}/regustration/ABCDEFGH`]);
  });
});

describe("the employee pane's details", () => {
  const openEmployees = async () => {
    const user = userEvent.setup();
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
    await screen.findByRole("button", { name: /Мария/ });
    return user;
  };

  it("does not repeat the status as its own label", async () => {
    await openEmployees();
    const details = screen.getByTestId("employee-details");
    expect(within(details).queryAllByText("Активен")).toHaveLength(0);
  });

  it.each([
    ["fullName", "Полное имя", "Мария"],
    ["email", "Почта", "maria@acme.by"],
    ["role", "Роль", "Менеджер"],
  ])("writes the %s row as a label and its value", async (key, label, value) => {
    await openEmployees();

    const row = screen.getByTestId(`employee-${key}`);
    expect(row).toHaveTextContent(label);
    expect(row).toHaveTextContent(value);
  });

  it("shows each project with its icon beside the checkbox", async () => {
    const user = await openEmployees();
    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));
    await screen.findByRole("dialog", { name: "Пригласить сотрудника" });

    const project = screen.getByTestId("invite-project-project-1");
    expect(within(project).getByRole("checkbox", { name: "Летний запуск" })).toBeInTheDocument();
    expect(within(project).getByRole("img", { name: "Летний запуск" })).toBeInTheDocument();
  });

  it("opens the invitation form in a dialog of its own, on top", async () => {
    const user = await openEmployees();

    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));

    expect(await screen.findByRole("dialog", { name: "Пригласить сотрудника" }))
      .toBeInTheDocument();
    expect(screen.getByTestId("contact-book-footer")).toBeInTheDocument();
  });

  it("closes the invitation form without sending anything", async () => {
    const user = await openEmployees();
    let posted = false;
    server.use(http.post("/api/invites", () => {
      posted = true;
      return HttpResponse.json(employeeInvite, { status: 201 });
    }));

    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));
    const form = await screen.findByRole("dialog", { name: "Пригласить сотрудника" });
    await user.click(within(form).getByRole("button", { name: "Отмена" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Пригласить сотрудника" }))
        .not.toBeInTheDocument());
    expect(posted).toBe(false);
  });

  it("puts the button that opens it in the contact book's footer", async () => {
    await openEmployees();

    const footer = screen.getByTestId("contact-book-footer");
    expect(within(footer).getByRole("button", { name: "Пригласить сотрудника" }))
      .toBeInTheDocument();
  });

  it("offers the client invite button in the same footer", async () => {
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });

    const footer = screen.getByTestId("contact-book-footer");
    expect(within(footer).getByRole("button", { name: "Пригласить клиента" })).toBeInTheDocument();
  });
});

describe("the invitation form's second step", () => {
  const openForm = async () => {
    const user = userEvent.setup();
    withDirectory();
    server.use(http.post("/api/invites", () => HttpResponse.json(employeeInvite, { status: 201 })));
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));
    const form = await screen.findByRole("dialog", { name: "Пригласить сотрудника" });
    return { user, form };
  };

  it("shows the link instead of closing once the invitation is created", async () => {
    const { user, form } = await openForm();

    await user.click(await within(form).findByRole("checkbox", { name: "Летний запуск" }));
    await user.click(within(form).getByRole("button", { name: "Создать приглашение" }));

    const link = `${window.location.origin}/regustration/ABCDEFGH`;
    expect(await within(form).findByText(link)).toBeInTheDocument();
    expect(within(form).queryByRole("checkbox", { name: "Летний запуск" })).not.toBeInTheDocument();
  });

  it("copies the whole link from that step", async () => {
    const { user, form } = await openForm();
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } },
    });

    await user.click(await within(form).findByRole("checkbox", { name: "Летний запуск" }));
    await user.click(within(form).getByRole("button", { name: "Создать приглашение" }));
    await within(form).findByText(`${window.location.origin}/regustration/ABCDEFGH`);
    await user.click(within(form).getByRole("button", { name: "Скопировать ссылку" }));

    expect(written).toEqual([`${window.location.origin}/regustration/ABCDEFGH`]);
  });

  it("closes from that step, and offers a blank form next time", async () => {
    const { user, form } = await openForm();
    await user.click(await within(form).findByRole("checkbox", { name: "Летний запуск" }));
    await user.click(within(form).getByRole("button", { name: "Создать приглашение" }));
    await within(form).findByText(`${window.location.origin}/regustration/ABCDEFGH`);

    await user.click(within(form).getByRole("button", { name: "Готово" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Пригласить сотрудника" }))
        .not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));
    const reopened = await screen.findByRole("dialog", { name: "Пригласить сотрудника" });
    expect(await within(reopened).findByRole("checkbox", { name: "Летний запуск" }))
      .not.toBeChecked();
  });
});

describe("choosing projects to grant", () => {
  it("draws each project as a card with its name and niche", async () => {
    const user = userEvent.setup();
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));
    await screen.findByRole("dialog", { name: "Пригласить сотрудника" });

    const card = screen.getByTestId("invite-project-project-1");
    expect(card).toHaveTextContent("Летний запуск");
    expect(card).toHaveTextContent("Перформанс");
    expect(within(card).getByRole("img", { name: "Летний запуск" })).toBeInTheDocument();
  });

  it("lays them out as a grid rather than a single column", async () => {
    const user = userEvent.setup();
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));
    await screen.findByRole("dialog", { name: "Пригласить сотрудника" });

    expect(screen.getByTestId("invite-projects").className).toMatch(/grid-cols-2/);
  });
});
