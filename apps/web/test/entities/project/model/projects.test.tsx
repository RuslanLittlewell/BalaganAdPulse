import { http as mock, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectsSync, refreshProjects, resetProjects, useProjects } from "@/entities/project/index.js";

const acme = aProject({ id: "p1", clientId: "c1", name: "Летний запуск" });
const globex = aProject({ id: "p2", clientId: "c2", name: "Осенний запуск" });

let asked = 0;

function List({ label, clientId }: { label: string; clientId?: string }) {
  const { data } = useProjects(clientId);
  return <p>{label}: {(data ?? []).map((project) => project.name).join(", ")}</p>;
}

beforeEach(() => {
  asked = 0;
  resetProjects();
  server.use(mock.get("/api/projects", () => {
    asked += 1;
    return HttpResponse.json([acme, globex]);
  }));
});

describe("the projects store", () => {
  it("asks the API once however many screens read the projects", async () => {
    renderWithProviders(<><List label="Доска" /><List label="Карточка" /></>);

    expect(await screen.findByText("Доска: Летний запуск, Осенний запуск")).toBeInTheDocument();
    expect(await screen.findByText("Карточка: Летний запуск, Осенний запуск")).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it("serves a screen opened later from the store, without asking again", async () => {
    const first = renderWithProviders(<List label="Доска" />);
    await screen.findByText(/Доска:/);
    first.unmount();

    renderWithProviders(<List label="Карточка" />);

    expect(await screen.findByText(/Карточка: Летний запуск/)).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it("narrows to one client's projects from what it holds", async () => {
    renderWithProviders(<List label="Лиды" clientId="c2" />);

    expect(await screen.findByText("Лиды: Осенний запуск")).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it("reloads on demand", async () => {
    renderWithProviders(<List label="Доска" />);
    await screen.findByText(/Доска:/);

    await refreshProjects();
    expect(asked).toBe(2);
  });

  it("forgets the projects when the session ends", async () => {
    renderWithProviders(<List label="Доска" />);
    await screen.findByText(/Доска:/);

    resetProjects();
    renderWithProviders(<List label="Карточка" />);

    expect(await screen.findByText(/Карточка: Летний запуск/)).toBeInTheDocument();
    expect(asked).toBe(2);
  });

  it("drops what it holds when the session it was loaded for ends", async () => {
    const session = renderWithProviders(<><ProjectsSync /><List label="Доска" /></>);
    await screen.findByText(/Доска:/);
    session.unmount();

    renderWithProviders(<><ProjectsSync /><List label="Карточка" /></>);

    expect(await screen.findByText(/Карточка: Летний запуск/)).toBeInTheDocument();
    expect(asked).toBe(2);
  });

  it("reports the wait, the answer and a refusal", async () => {
    function Waiting() {
      const { isPending, isSuccess, isError } = useProjects();
      return <p>{isPending ? "ждём" : isSuccess ? "готово" : isError ? "ошибка" : "?"}</p>;
    }
    renderWithProviders(<Waiting />);

    expect(screen.getByText("ждём")).toBeInTheDocument();
    expect(await screen.findByText("готово")).toBeInTheDocument();
  });

  it("offers a retry after a refusal", async () => {
    server.use(mock.get("/api/projects", () => {
      asked += 1;
      return asked === 1
        ? HttpResponse.json({ error: { message: "нет" } }, { status: 500 })
        : HttpResponse.json([acme]);
    }));

    function Retrying() {
      const { data, isError, refetch } = useProjects();
      return (
        <>
          <p>{isError ? "ошибка" : (data ?? []).map((project) => project.name).join(", ")}</p>
          <button type="button" onClick={() => void refetch()}>Ещё раз</button>
        </>
      );
    }
    renderWithProviders(<Retrying />);
    expect(await screen.findByText("ошибка")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ещё раз" }));
    expect(await screen.findByText("Летний запуск")).toBeInTheDocument();
  });
});
