import { http as mock, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { renderWithProviders, server } from "@test/shared/index.js";
import {
  CampaignNamesSync,
  resetCampaignNames,
  useCampaignNames,
  useProjectCampaignNames,
} from "@/entities/campaign/index.js";

const references = [
  { id: "camp-1", projectId: "project-1", name: "Поиск / Москва", channel: "YANDEX" },
  { id: "camp-2", projectId: "project-2", name: "Лента", channel: "META" },
];

let asked = 0;

function Names({ label }: { label: string }) {
  const { data } = useCampaignNames();
  return <p>{label}: {(data ?? []).map((reference) => reference.name).join(", ")}</p>;
}

function OfProject({ projectId }: { projectId: string }) {
  const { data } = useProjectCampaignNames(projectId);
  return <p>Проект: {(data ?? []).map((reference) => reference.name).join(", ")}</p>;
}

beforeEach(() => {
  asked = 0;
  resetCampaignNames();
  server.use(mock.get("/api/campaigns/names", () => {
    asked += 1;
    return HttpResponse.json(references);
  }));
});

describe("the campaign name store", () => {
  it("asks the API once however many screens read the names", async () => {
    renderWithProviders(<><Names label="Доска" /><Names label="Карточка" /></>);

    expect(await screen.findByText("Доска: Поиск / Москва, Лента")).toBeInTheDocument();
    expect(await screen.findByText("Карточка: Поиск / Москва, Лента")).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it("serves a screen opened later without asking again", async () => {
    const first = renderWithProviders(<Names label="Доска" />);
    await screen.findByText(/Доска:/);
    first.unmount();

    renderWithProviders(<Names label="Карточка" />);
    expect(await screen.findByText(/Карточка: Поиск/)).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it("narrows to one project's campaigns from what it holds", async () => {
    renderWithProviders(<OfProject projectId="project-2" />);

    expect(await screen.findByText("Проект: Лента")).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it("holds nothing for a project with no campaigns", async () => {
    renderWithProviders(<OfProject projectId="project-9" />);

    expect(await screen.findByText("Проект:")).toBeInTheDocument();
  });

  it("drops what it holds when the module that loaded it is left", async () => {
    const module = renderWithProviders(<><CampaignNamesSync /><Names label="Доска" /></>);
    await screen.findByText(/Доска:/);
    module.unmount();

    renderWithProviders(<><CampaignNamesSync /><Names label="Карточка" /></>);
    expect(await screen.findByText(/Карточка: Поиск/)).toBeInTheDocument();
    expect(asked).toBe(2);
  });

  it("reports the wait so a screen can show its loader", async () => {
    function Waiting() {
      const { isPending, isSuccess } = useCampaignNames();
      return <p>{isPending ? "ждём" : isSuccess ? "готово" : "ошибка"}</p>;
    }
    renderWithProviders(<Waiting />);

    expect(screen.getByText("ждём")).toBeInTheDocument();
    expect(await screen.findByText("готово")).toBeInTheDocument();
  });
});
