import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiSelect, type MultiSelectItem } from "@/shared/ui/index.js";

const items: MultiSelectItem[] = [
  { value: "m1", label: "Пётр", icon: <span data-testid="icon-m1">П</span> },
  { value: "m2", label: "Анна", icon: <span data-testid="icon-m2">А</span> },
  { value: "none", label: "Не назначен" },
];

function show(chosen: string[] = [], onChange = (_next: string[]) => {}) {
  return render(
    <MultiSelect
      items={items}
      chosen={chosen}
      onChange={onChange}
      placeholder="Ответственный"
      ariaLabel="Фильтр по ответственным"
    />,
  );
}

function Harness({ initial = [] as string[] }) {
  const [chosen, setChosen] = useState(initial);
  return (
    <MultiSelect
      items={items}
      chosen={chosen}
      onChange={setChosen}
      placeholder="Ответственный"
      ariaLabel="Фильтр по ответственным"
    />
  );
}

const trigger = () => screen.getByRole("button", { name: /Фильтр по ответственным/ });
const open = async (user: ReturnType<typeof userEvent.setup>) => user.click(trigger());

describe("the face of a multi-select", () => {
  it("names what it is for while nothing is chosen", () => {
    show();
    expect(trigger()).toHaveTextContent("Ответственный");
  });

  it("names the one chosen option", () => {
    show(["m2"]);
    expect(trigger()).toHaveTextContent("Анна");
  });

  it("says how many more are chosen beyond the first", () => {
    show(["m1", "m2"]);
    expect(trigger()).toHaveTextContent("Пётр");
    expect(trigger()).toHaveTextContent("+1");
  });
});

describe("choosing from a multi-select", () => {
  it("offers every option once the menu is open", async () => {
    const user = userEvent.setup();
    show();
    await open(user);

    for (const label of ["Пётр", "Анна", "Не назначен"]) {
      expect(await screen.findByRole("menuitemcheckbox", { name: label })).toBeInTheDocument();
    }
  });

  it("carries whatever the caller puts beside an option", async () => {
    const user = userEvent.setup();
    show();
    await open(user);

    expect(await screen.findByTestId("icon-m1")).toBeInTheDocument();
  });

  it("marks the chosen ones and leaves the rest unmarked", async () => {
    const user = userEvent.setup();
    show(["m1"]);
    await open(user);

    expect(await screen.findByRole("menuitemcheckbox", { name: "Пётр" }))
      .toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Анна" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("reports the option that was chosen", async () => {
    const user = userEvent.setup();
    const seen: string[][] = [];
    show([], (next) => seen.push(next));
    await open(user);

    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Анна" }));

    expect(seen).toEqual([["m2"]]);
  });

  it("reports the option that was unchosen", async () => {
    const user = userEvent.setup();
    const seen: string[][] = [];
    show(["m1", "m2"], (next) => seen.push(next));
    await open(user);

    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Пётр" }));

    expect(seen).toEqual([["m2"]]);
  });

  it("stays open so several can be chosen in one go", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Пётр" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Анна" }));

    expect(screen.getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(2);
  });
});

describe("reaching a multi-select from the keyboard", () => {
  it("opens on the keyboard and marks what is chosen there", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    trigger().focus();
    await user.keyboard("{Enter}");

    const option = await screen.findByRole("menuitemcheckbox", { name: "Пётр" });
    expect(option).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(1);
  });
});
