import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aPlatformOrganization, renderWithProviders, server } from "@test/shared/index.js";
import { AddOrganization, OrganizationFormDialog } from "@/features/organization-admin/index.js";

function captureCreate(response: () => Response = () => HttpResponse.json({
  organization: aPlatformOrganization({ id: "org-2", name: "Acme" }),
  registrationUrl: "/registration/ABCDEFGH",
}, { status: 201 })) {
  const bodies: unknown[] = [];
  server.use(mock.post("/api/platform/organizations", async ({ request }) => {
    bodies.push(await request.json());
    return response();
  }));
  return bodies;
}

async function openCreate() {
  renderWithProviders(<AddOrganization />);
  await userEvent.click(screen.getByRole("button", { name: "Добавить организацию" }));
  return screen.findByRole("dialog", { name: "Новая организация" });
}

describe("adding an organization", () => {
  it("asks for a name, the first administrator's email and a tariff, starting on the trial", async () => {
    await openCreate();

    expect(screen.getByLabelText("Название")).toHaveValue("");
    expect(screen.getByLabelText("Email первого администратора")).toHaveValue("");
    const tariffs = screen.getByRole("group", { name: "Тариф" });
    expect(within(tariffs).getAllByRole("radio").map((radio) => radio.getAttribute("aria-label")))
      .toEqual(["Пробный период", "Solo", "Business", "Agency", "Agency Pro", "Enterprise"]);
    expect(screen.getByRole("radio", { name: "Пробный период" })).toBeChecked();
  });

  it("describes each tariff by its audience and price", async () => {
    await openCreate();

    expect(screen.getByRole("radio", { name: "Business" }))
      .toHaveAccessibleDescription("Малый бизнес. 1 компания, до 3 рекламных кабинетов, CRM лидов, 3 пользователя");
    expect(screen.getByText("$49")).toBeInTheDocument();
    expect(screen.getByText("$799")).toBeInTheDocument();
  });

  it("sends the name, the chosen tariff and the email, then shows the link", async () => {
    const bodies = captureCreate();
    await openCreate();

    await userEvent.type(screen.getByLabelText("Название"), "  Acme ");
    await userEvent.type(screen.getByLabelText("Email первого администратора"), "owner@acme.com");
    await userEvent.click(screen.getByRole("radio", { name: "Agency" }));
    await userEvent.click(screen.getByRole("button", { name: "Создать организацию" }));

    expect(await screen.findByText(`${window.location.origin}/registration/ABCDEFGH`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скопировать ссылку регистрации" })).toBeInTheDocument();
    expect(bodies).toEqual([{ name: "Acme", tariff: "AGENCY", adminEmail: "owner@acme.com" }]);
  });

  it("sends the trial when no other tariff is chosen", async () => {
    const bodies = captureCreate();
    await openCreate();

    await userEvent.type(screen.getByLabelText("Название"), "Acme");
    await userEvent.type(screen.getByLabelText("Email первого администратора"), "owner@acme.com");
    await userEvent.click(screen.getByRole("button", { name: "Создать организацию" }));

    await screen.findByText(/registration/);
    expect(bodies).toEqual([{ name: "Acme", tariff: "TRIAL", adminEmail: "owner@acme.com" }]);
  });

  it("names a missing name and an invalid email without sending anything", async () => {
    const bodies = captureCreate();
    await openCreate();

    await userEvent.type(screen.getByLabelText("Email первого администратора"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Создать организацию" }));

    expect(screen.getByLabelText("Название")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Укажите название")).toBeInTheDocument();
    expect(screen.getByLabelText("Email первого администратора")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Укажите корректный email")).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it("says so when the email already has an account", async () => {
    captureCreate(() => HttpResponse.json(
      { error: { message: "This email is already registered" } }, { status: 409 },
    ));
    await openCreate();

    await userEvent.type(screen.getByLabelText("Название"), "Acme");
    await userEvent.type(screen.getByLabelText("Email первого администратора"), "taken@acme.com");
    await userEvent.click(screen.getByRole("button", { name: "Создать организацию" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Этот email уже зарегистрирован");
  });

  it("reports any other failure", async () => {
    captureCreate(() => HttpResponse.json({ error: { message: "boom" } }, { status: 500 }));
    await openCreate();

    await userEvent.type(screen.getByLabelText("Название"), "Acme");
    await userEvent.type(screen.getByLabelText("Email первого администратора"), "owner@acme.com");
    await userEvent.click(screen.getByRole("button", { name: "Создать организацию" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось сохранить организацию");
  });
});

describe("editing an organization", () => {
  const organization = aPlatformOrganization({
    id: "org-2", name: "Acme", tariff: "BUSINESS", modules: ["DASHBOARD", "PROJECTS", "CRM"],
  });

  function captureUpdate() {
    const bodies: unknown[] = [];
    server.use(mock.patch("/api/platform/organizations/org-2", async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      bodies.push(body);
      return HttpResponse.json({ ...organization, ...body });
    }));
    return bodies;
  }

  it("starts from the organization's name and tariff and asks for no email", async () => {
    renderWithProviders(<OrganizationFormDialog organization={organization} open onClose={() => {}} />);

    await screen.findByRole("dialog", { name: "Организация" });
    expect(screen.getByLabelText("Название")).toHaveValue("Acme");
    expect(screen.queryByLabelText("Email первого администратора")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Business" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Пробный период" })).not.toBeChecked();
  });

  it("renames it and changes the tariff, then closes", async () => {
    const bodies = captureUpdate();
    const onClose = vi.fn();
    renderWithProviders(<OrganizationFormDialog organization={organization} open onClose={onClose} />);

    const name = await screen.findByLabelText("Название");
    await userEvent.clear(name);
    await userEvent.type(name, "Acme Ltd");
    await userEvent.click(screen.getByRole("radio", { name: "Agency Pro" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ name: "Acme Ltd", tariff: "AGENCY_PRO" }]);
  });
});
