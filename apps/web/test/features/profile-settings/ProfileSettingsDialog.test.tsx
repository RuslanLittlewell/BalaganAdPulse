import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeAccessToken, renderWithProviders, server } from "@test/shared/index.js";
import { ProfileSettingsDialog } from "@/features/profile-settings/index.js";

function setup() {
  return renderWithProviders(
    <ProfileSettingsDialog open onClose={() => {}} onAvatarSaved={() => {}} />,
  );
}

const form = () => screen.getByLabelText("Имя").closest("form")!;

describe("the outcome of saving a profile", () => {
  it("announces a saved profile as a notification, not as text under the form", async () => {
    server.use(http.patch("/api/user/profile", () =>
      HttpResponse.json({ accessToken: makeAccessToken() })));
    setup();
    await waitFor(() => expect(screen.getByLabelText("Имя")).toHaveValue("Buyer"));

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Профиль сохранён");
    expect(form()).not.toContainElement(alert);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces why a save was refused as a notification", async () => {
    server.use(http.patch("/api/user/profile", () =>
      HttpResponse.json({ error: { message: "Current password is incorrect" } }, { status: 400 })));
    setup();
    await waitFor(() => expect(screen.getByLabelText("Имя")).toHaveValue("Buyer"));

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Current password is incorrect");
    expect(form()).not.toContainElement(alert);
  });

  it("announces a profile that could not be loaded as a notification", async () => {
    server.use(http.get("/api/user/profile", () =>
      HttpResponse.json({ error: { message: "boom" } }, { status: 500 })));
    setup();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не удалось загрузить профиль");
    expect(form()).not.toContainElement(alert);
  });
});
