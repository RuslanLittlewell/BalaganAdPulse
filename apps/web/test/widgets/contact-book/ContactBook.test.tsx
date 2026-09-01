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
    // A bare handle, a bare domain and a spaced phone number all become links.
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
    // Registered after open(), whose own handler would otherwise win: MSW
    // resolves with the most recently added match.
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
  image: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-08-31T10:00:00.000Z",
};

function withDirectory() {
  server.use(
    http.get("/api/clients", () => HttpResponse.json([acme, bare])),
    http.get("/api/members", () => HttpResponse.json([member])),
    http.get("/api/projects", () => HttpResponse.json([
      { id: "project-1", clientId: "1", name: "Летний запуск", niche: "Перформанс",
        monthlyBudget: null, priority: "NEW", image: "data:image/png;base64,AAA",
        avatarPath: null, position: 0, createdAt: "2026-09-01T00:00:00.000Z",
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

  it("switches to the employees pane", async () => {
    const user = userEvent.setup();
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });

    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

    expect(await screen.findByRole("button", { name: /Мария/ })).toBeInTheDocument();
    // The client list is the other pane's content, not a filter over the same one.
    expect(screen.queryByRole("button", { name: /Acme/ })).not.toBeInTheDocument();
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
  it("lists the pending invitations of the pane it is on", async () => {
    const user = userEvent.setup();
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });

    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

    // The whole address, built from wherever the app is being served: the
    // backend deliberately returns a relative path so it needs no host
    // configuration, and this is where it becomes something pasteable.
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

  // The API refuses this too; saying so here saves a round trip and explains
  // why the button did nothing.
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

    await user.click(await screen.findByRole("button", { name: "Отозвать ABCDEFGH" }));

    await waitFor(() => expect(revoked).toBe(true));
  });

  it("offers the whole registration link to copy, not just the code", async () => {
    const user = userEvent.setup();
    const written: string[] = [];
    // navigator.clipboard is getter-only in jsdom, so it has to be redefined
    // rather than assigned.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } },
    });
    withDirectory();
    renderWithProviders(<ContactBook open onClose={() => {}} />);
    await screen.findByRole("button", { name: /Acme/ });
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));

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

  // It read "Активен / Активен": the status value was being used as its own
  // label. The row said nothing the value did not.
  it("does not repeat the status as its own label", async () => {
    await openEmployees();
    const details = screen.getByTestId("employee-details");
    expect(within(details).queryAllByText("Активен")).toHaveLength(0);
  });

  // Label and value sit in one row rather than stacked. They are separate
  // elements, so the row's text is asserted in both halves rather than as one
  // string that a change of spacing would break.
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
    // The logo travels inside the project, so the row can draw it directly.
    expect(within(project).getByRole("img", { name: "Летний запуск" })).toBeInTheDocument();
  });

  // Opened over the contact book rather than crowding the pane: the form has a
  // role, a project list and its own validation, and the pane behind it is
  // still the list of who is already here.
  it("opens the invitation form in a dialog of its own, on top", async () => {
    const user = await openEmployees();

    await user.click(screen.getByRole("button", { name: "Пригласить сотрудника" }));

    expect(await screen.findByRole("dialog", { name: "Пригласить сотрудника" }))
      .toBeInTheDocument();
    // The contact book stays mounted underneath rather than being replaced.
    // It is not asserted by role: while a nested modal is open the outer one is
    // marked aria-hidden and leaves the accessibility tree, which is the
    // behaviour that makes the inner dialog the only thing reachable.
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

  /**
   * The link is the whole point of creating an invitation, and it exists only
   * once the server has answered. Closing on success would leave the person who
   * asked for it hunting through the list to find what they just made.
   */
  it("shows the link instead of closing once the invitation is created", async () => {
    const { user, form } = await openForm();

    await user.click(await within(form).findByRole("checkbox", { name: "Летний запуск" }));
    await user.click(within(form).getByRole("button", { name: "Создать приглашение" }));

    const link = `${window.location.origin}/regustration/ABCDEFGH`;
    expect(await within(form).findByText(link)).toBeInTheDocument();
    // The form it was filled in on is gone: this step is about the result.
    expect(within(form).queryByRole("checkbox", { name: "Летний запуск" })).not.toBeInTheDocument();
  });

  it("copies the whole link from that step", async () => {
    const { user, form } = await openForm();
    // After userEvent.setup(), which installs a clipboard stub of its own and
    // would otherwise replace this one.
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
    // Back to the form, with nothing carried over from the last one.
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
