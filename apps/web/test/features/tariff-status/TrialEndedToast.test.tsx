import { http as mock, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@test/shared/index.js";
import { createQueryClient, http } from "@/shared/lib/index.js";
import { AlertsProvider, useAlerts } from "@/shared/ui/index.js";
import { TrialEndedToast } from "@/features/tariff-status/index.js";

const ended = () => HttpResponse.json(
  { error: { message: "The trial has ended.", details: [{ code: "TRIAL_ENDED" }] } },
  { status: 403 },
);

function Page() {
  const { raise } = useAlerts();
  const fail = () => raise("Не удалось сохранить");
  return (
    <>
      <button type="button" onClick={() => void http.patch("/tasks/t1", { column: "DONE" }).catch(fail)}>задача</button>
      <button type="button" onClick={() => void http.patch("/projects/p1", { name: "Новое" }).catch(fail)}>проект</button>
      <button type="button" onClick={() => void http.patch("/crm/leads/l1", { name: "Лид" }).catch(fail)}>лид</button>
      <button type="button" onClick={() => void http.patch("/members/m1", {}).catch(fail)}>роль</button>
      <button
        type="button"
        onClick={() => void Promise.allSettled([1, 2, 3].map(() => http.patch("/tasks/t1", {}))).then(() => fail())}
      >
        пачка
      </button>
    </>
  );
}

function setup() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <AlertsProvider>
        <TrialEndedToast />
        <Page />
      </AlertsProvider>
    </QueryClientProvider>,
  );
}

const TOAST = "Пробный период закончился, изменения недоступны.";

describe("the trial-ended toast", () => {
  it.each([["задача", "/api/tasks/t1"], ["проект", "/api/projects/p1"], ["лид", "/api/crm/leads/l1"]])(
    "tells a member their %s change was refused because the trial ended, and nothing else",
    async (button, path) => {
      server.use(mock.patch(path, ended));
      setup();

      await userEvent.click(screen.getByRole("button", { name: button }));

      expect(await screen.findByText(TOAST)).toBeInTheDocument();
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.queryByText("Не удалось сохранить")).not.toBeInTheDocument();
    },
  );

  it("raises one toast for several refusals at once", async () => {
    server.use(mock.patch("/api/tasks/t1", ended));
    setup();

    await userEvent.click(screen.getByRole("button", { name: "пачка" }));

    expect(await screen.findByText(TOAST)).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("stays silent for a refusal that is not about the trial", async () => {
    server.use(mock.patch("/api/members/m1", () => HttpResponse.json(
      { error: { message: "Forbidden", details: [{ code: "TARIFF_LIMIT", resource: "users", limit: 3 }] } },
      { status: 403 },
    )));
    setup();

    await userEvent.click(screen.getByRole("button", { name: "роль" }));

    expect(await screen.findByText("Не удалось сохранить")).toBeInTheDocument();
    expect(screen.queryByText(TOAST)).not.toBeInTheDocument();
  });
});
