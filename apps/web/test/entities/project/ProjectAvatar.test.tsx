import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { aProject, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectAvatar } from "@/entities/project/ui/project-avatar/ProjectAvatar.js";

describe("ProjectAvatar", () => {
  it("falls back to the initial while the project has no logo", () => {
    renderWithProviders(<ProjectAvatar project={aProject({ name: "Летний запуск" })} />);
    expect(screen.getByText("Л")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the logo straight from the project, fetching nothing", () => {
    let asked = 0;
    server.use(
      http.get("/api/projects/:id/avatar", () => {
        asked += 1;
        return new HttpResponse(null, { status: 404 });
      }),
    );
    const image = "data:image/png;base64,iVBORw0KGgo=";
    renderWithProviders(<ProjectAvatar project={aProject({ name: "Летний запуск", image })} />);

    expect(screen.getByRole("img", { name: "Летний запуск" })).toHaveAttribute("src", image);
    expect(asked).toBe(0);
  });
});
