import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, server } from "@test/shared/index.js";
import { UserAvatar } from "@/features/auth/ui/user-avatar/UserAvatar.js";

const DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

function forbidAvatarRequests() {
  let asked = 0;
  server.use(
    http.get("/api/user/avatar", () => {
      asked += 1;
      return new HttpResponse(null, { status: 404 });
    }),
  );
  return () => asked;
}

function withProfile(image: string | null) {
  server.use(
    http.get("/api/user/profile", () =>
      HttpResponse.json({ name: "Buyer", email: "buyer@acme.com", image, avatarPath: null })),
  );
}

describe("UserAvatar", () => {
  it("never asks for avatar bytes — the profile carries them", async () => {
    const asked = forbidAvatarRequests();
    withProfile(DATA_URL);
    renderWithProviders(<UserAvatar userId="u1" name="Buyer" />);

    await waitFor(() => expect(screen.getByRole("img", { name: "Buyer" }).tagName).toBe("IMG"));
    expect(asked()).toBe(0);
  });

  it("renders the picture straight from the profile", async () => {
    withProfile(DATA_URL);
    renderWithProviders(<UserAvatar userId="u1" name="Buyer" />);

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Buyer" })).toHaveAttribute("src", DATA_URL));
  });

  it("shows the placeholder when the profile has no picture", async () => {
    const asked = forbidAvatarRequests();
    withProfile(null);
    renderWithProviders(<UserAvatar userId="u1" name="Buyer" />);

    const placeholder = await screen.findByRole("img", { name: "Buyer" });
    expect(placeholder.tagName).toBe("DIV");
    expect(asked()).toBe(0);
  });

  it("keeps the placeholder while the profile is still loading", () => {
    withProfile(DATA_URL);
    renderWithProviders(<UserAvatar userId="u1" name="Buyer" />);
    expect(screen.getByRole("img", { name: "Buyer" }).tagName).toBe("DIV");
  });
});
