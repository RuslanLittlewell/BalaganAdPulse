import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { aClient, renderWithProviders, server } from "@test/shared/index.js";
import { ContactAvatar } from "@/widgets/contact-book/ContactAvatar.js";
import { ClientAvatar } from "@/entities/client/index.js";

describe("ClientAvatar", () => {
  it("falls back to the initial while the client has no picture", () => {
    renderWithProviders(<ClientAvatar client={aClient({ name: "Acme" })} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the picture straight from the client, fetching nothing", () => {
    let asked = 0;
    server.use(
      http.get("/api/clients/:id/avatar", () => {
        asked += 1;
        return new HttpResponse(null, { status: 404 });
      }),
    );
    const image = "data:image/png;base64,iVBORw0KGgo=";
    renderWithProviders(<ClientAvatar client={aClient({ name: "Acme", image })} />);

    expect(screen.getByRole("img", { name: "Acme" })).toHaveAttribute("src", image);
    expect(asked).toBe(0);
  });
});

describe("ContactAvatar", () => {
  function render() {
    return renderWithProviders(<ContactAvatar client={aClient({ name: "Acme" })} />);
  }

  it("offers a control for changing the picture", () => {
    render();
    expect(screen.getByRole("button", { name: "Изменить изображение" })).toBeInTheDocument();
  });

  it("opens a menu with exactly the two ways to set one", async () => {
    render();
    await userEvent.click(screen.getByRole("button", { name: "Изменить изображение" }));

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Загрузить лого", "Создать аватар"]);
  });

  it("reuses the avatar editor for the generated option", async () => {
    render();
    await userEvent.click(screen.getByRole("button", { name: "Изменить изображение" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Создать аватар" }));

    expect(await screen.findByRole("dialog", { name: "Редактор аватара" })).toBeInTheDocument();
    // The same 13 controls the profile editor shows — one component, two callers.
    expect(screen.getAllByRole("combobox")).toHaveLength(13);
  });

  it("accepts any image the browser can read for the uploaded option", () => {
    render();
    expect(screen.getByLabelText("Загрузить лого")).toHaveAttribute("accept", "image/*");
  });
});
