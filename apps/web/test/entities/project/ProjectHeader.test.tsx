import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject } from "@test/shared/index.js";
import { ProjectHeader } from "@/entities/project/index.js";

describe("the project header", () => {
  it("offers preview before the KPI-tracking switch when the page asks for it", async () => {
    let previewed = false;
    render(<ProjectHeader project={aProject({ name: "Клиника" })} clientName="Acme" onPreview={() => { previewed = true; }} />);

    const preview = screen.getByRole("button", { name: "Превью" });
    const tracking = screen.getByRole("switch", { name: "Отслеживать KPI" });
    expect(preview.compareDocumentPosition(tracking) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.click(preview);
    expect(previewed).toBe(true);
  });

  it("offers no preview when the page does not ask for it", () => {
    render(<ProjectHeader project={aProject({ name: "Клиника" })} clientName="Acme" />);

    expect(screen.queryByRole("button", { name: "Превью" })).not.toBeInTheDocument();
  });
});
