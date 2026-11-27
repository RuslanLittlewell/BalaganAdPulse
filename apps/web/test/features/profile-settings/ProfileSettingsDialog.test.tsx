import { http, HttpResponse } from "msw";
import { useState } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAccessToken, renderWithProviders, server } from "@test/shared/index.js";
import { ProfileSettingsDialog } from "@/features/profile-settings/index.js";
import { getLocale, reloadForLocale, saveLocale } from "@/shared/config/locale.js";

vi.mock("@/shared/config/locale.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/config/locale.js")>(),
  reloadForLocale: vi.fn(),
}));

beforeEach(() => {
  localStorage.removeItem("adpulse.language");
  localStorage.removeItem("adpulse.profile.user-1.campaignCrm");
});

afterEach(() => {
  localStorage.removeItem("adpulse.language");
  localStorage.removeItem("adpulse.profile.user-1.campaignCrm");
  document.documentElement.lang = "ru";
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function setup() {
  function ControlledDialog() {
    const [open, setOpen] = useState(true);
    return <ProfileSettingsDialog open={open} onClose={() => setOpen(false)} onAvatarSaved={() => {}} />;
  }
  return renderWithProviders(
    <ControlledDialog />,
  );
}

const form = () => screen.getByLabelText("Имя").closest("form")!;

async function openAccount() {
  await userEvent.click(screen.getByRole("radio", { name: "Аккаунт" }));
}

async function openGeneral() {
  await userEvent.click(screen.getByRole("radio", { name: "Общее" }));
}

describe("profile preferences", () => {
  it("opens Account first and preserves account edits when switching tabs with the keyboard", async () => {
    setup();
    const account = screen.getByRole("radio", { name: "Аккаунт" });
    expect(account).toBeChecked();
    expect(screen.getAllByRole("radio").map((item) => item.textContent)).toEqual(["Аккаунт", "Общее", "Безопасность"]);
    await waitFor(() => expect(screen.getByLabelText("Имя")).toHaveValue("Buyer"));
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.type(screen.getByLabelText("Имя"), "New name");
    account.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Общее" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Язык интерфейса" })).toHaveTextContent("Русский");
    expect(screen.queryByRole("textbox", { name: "Имя" })).not.toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("textbox", { name: "Имя" })).toHaveValue("New name");
  });

  it("saves General without submitting invalid account fields and holds no CRM by campaign switch", async () => {
    let patched = false;
    server.use(http.patch("/api/user/profile", () => {
      patched = true;
      return HttpResponse.json({ accessToken: makeAccessToken() });
    }));
    setup();
    await openAccount();
    await waitFor(() => expect(screen.getByLabelText("Имя")).toHaveValue("Buyer"));
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.click(screen.getByRole("radio", { name: "Общее" }));
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText("Настройки сохранены")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(patched).toBe(false);
  });

  it("saves English only on Save and reloads to translate labels created at startup", async () => {
    setup();
    await openGeneral();
    await waitFor(() => expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled());
    await userEvent.click(screen.getByRole("combobox", { name: "Язык интерфейса" }));
    await userEvent.click(screen.getByRole("option", { name: "English" }));
    expect(screen.getByRole("combobox", { name: "Язык интерфейса" })).toHaveTextContent("English");
    expect(getLocale()).toBe("ru");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(getLocale()).toBe("en");
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(reloadForLocale).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the English profile with saved preferences", async () => {
    saveLocale("en");
    setup();
    expect(screen.getByRole("dialog", { name: "Profile settings" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Account" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "General" }));
    expect(screen.getByRole("combobox", { name: "Interface language" })).toHaveTextContent("English");
    await userEvent.click(screen.getByRole("radio", { name: "Account" }));
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit avatar" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "General" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Interface language" }));
    await userEvent.click(screen.getByRole("option", { name: "Русский" }));
    expect(screen.getByRole("combobox", { name: "Interface language" })).toHaveTextContent("Русский");
    expect(getLocale()).toBe("en");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(getLocale()).toBe("ru");
    expect(reloadForLocale).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("discards unsaved General preferences when the dialog closes", async () => {
    function ReopenableDialog() {
      const [open, setOpen] = useState(true);
      return <>
        <button onClick={() => setOpen(true)}>Открыть</button>
        <ProfileSettingsDialog open={open} onClose={() => setOpen(false)} onAvatarSaved={() => {}} />
      </>;
    }
    renderWithProviders(<ReopenableDialog />);
    await openGeneral();
    await waitFor(() => expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled());
    await userEvent.click(screen.getByRole("combobox", { name: "Язык интерфейса" }));
    await userEvent.click(screen.getByRole("option", { name: "English" }));
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    await userEvent.click(screen.getByRole("button", { name: "Открыть" }));
    expect(screen.getByRole("radio", { name: "Аккаунт" })).toBeChecked();
    await openGeneral();
    expect(screen.getByRole("combobox", { name: "Язык интерфейса" })).toHaveTextContent("Русский");
  });

  it("reports a storage failure instead of announcing a saved preference", async () => {
    setup();
    await openGeneral();
    await waitFor(() => expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось сохранить профиль");
    expect(screen.getByRole("dialog", { name: "Настройки профиля" })).toBeInTheDocument();
    expect(screen.queryByText("Настройки сохранены")).not.toBeInTheDocument();
  });
});

describe("the outcome of saving a profile", () => {
  it("keeps the dialog open until the account save succeeds", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    server.use(http.patch("/api/user/profile", async () => {
      await pending;
      return HttpResponse.json({ accessToken: makeAccessToken() });
    }));
    setup();
    await openAccount();
    await waitFor(() => expect(screen.getByLabelText("Имя")).toHaveValue("Buyer"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
    expect(screen.getByRole("dialog", { name: "Настройки профиля" })).toBeInTheDocument();
    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Профиль сохранён")).toBeInTheDocument();
  });

  it("keeps the dialog open when account validation fails", async () => {
    setup();
    await openAccount();
    await waitFor(() => expect(screen.getByLabelText("Имя")).toHaveValue("Buyer"));
    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(await screen.findByText("Введите имя")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Настройки профиля" })).toBeInTheDocument();
  });

  it("announces a saved profile as a notification, not as text under the form", async () => {
    server.use(http.patch("/api/user/profile", () =>
      HttpResponse.json({ accessToken: makeAccessToken() })));
    setup();
    await openAccount();
    await waitFor(() => expect(screen.getByLabelText("Имя")).toHaveValue("Buyer"));

    const profileForm = form();
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const region = screen.getByRole("region", { name: "Уведомления" });
    const status = await within(region).findByText("Профиль сохранён");
    expect(status.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(profileForm).not.toContainElement(status);
    expect(within(profileForm).queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces why a save was refused as a notification", async () => {
    server.use(http.patch("/api/user/profile", () =>
      HttpResponse.json({ error: { message: "Current password is incorrect" } }, { status: 400 })));
    setup();
    await openAccount();
    await waitFor(() => expect(screen.getByLabelText("Имя")).toHaveValue("Buyer"));

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Current password is incorrect");
    expect(screen.getByRole("dialog", { name: "Настройки профиля" })).toBeInTheDocument();
    expect(form()).not.toContainElement(alert);
  });

  it("announces a profile that could not be loaded as a notification", async () => {
    server.use(http.get("/api/user/profile", () =>
      HttpResponse.json({ error: { message: "boom" } }, { status: 500 })));
    setup();
    await openAccount();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не удалось загрузить профиль");
    expect(form()).not.toContainElement(alert);
  });
});
