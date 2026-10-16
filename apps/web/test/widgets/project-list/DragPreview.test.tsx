import { render, screen } from "@testing-library/react";
import { aProject } from "@test/shared/index.js";
import { DragPreview } from "@/widgets/project-list/DragPreview.js";

describe("DragPreview", () => {
  it("carries the project's picture, client and KPI marker while it is dragged", () => {
    render(
      <DragPreview
        project={aProject({ name: "Альфа", image: "data:image/png;base64,x" })}
        clientName="Acme"
        tone="danger"
      />,
    );

    expect(screen.getByText("Альфа")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("KPI: серьёзное отставание")).toBeInTheDocument();
    expect(screen.getByAltText("Альфа")).toBeInTheDocument();
  });

  it("falls back to the drawn avatar when a project has no picture", () => {
    render(<DragPreview project={aProject({ name: "Альфа" })} clientName="Acme" />);
    expect(screen.getByText("Альфа")).toBeInTheDocument();
    expect(screen.getByText("KPI: цель не задана или не измерена")).toBeInTheDocument();
  });

  it("carries a group's name", () => {
    render(<DragPreview groupName="Клиенты" />);
    expect(screen.getByText("Клиенты")).toBeInTheDocument();
  });

  it("draws nothing when nothing is dragged", () => {
    const { container } = render(<DragPreview />);
    expect(container).toBeEmptyDOMElement();
  });
});
