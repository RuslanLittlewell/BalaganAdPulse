import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiSelect, type MultiSelectItem } from "@/shared/ui/index.js";

const items: MultiSelectItem[] = [
  { value: "m1", label: "Пётр", icon: <span data-testid="icon-m1">П</span> },
  { value: "m2", label: "Анна", icon: <span data-testid="icon-m2">А</span> },
  { value: "none", label: "Не назначен" },
];

function show(chosen: string[] = [], onChange = (_next: string[]) => {}, allLabel?: string) {
  return render(
    <MultiSelect
      items={items}
      allLabel={allLabel}
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

describe("the all entry of a multi-select", () => {
  it("is absent unless the caller names it", async () => {
    const user = userEvent.setup();
    show();
    await open(user);

    await screen.findByRole("menuitemcheckbox", { name: "Пётр" });
    expect(screen.queryByRole("menuitemcheckbox", { name: "Все" })).not.toBeInTheDocument();
  });

  it("chooses every option at once", async () => {
    const user = userEvent.setup();
    const seen: string[][] = [];
    show(["m1"], (next) => seen.push(next), "Все");
    await open(user);

    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Все" }));

    expect(seen).toEqual([["m1", "m2", "none"]]);
  });

  it("clears the choice while every option is chosen", async () => {
    const user = userEvent.setup();
    const seen: string[][] = [];
    show(["m1", "m2", "none"], (next) => seen.push(next), "Все");
    await open(user);

    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Все" }));

    expect(seen).toEqual([[]]);
  });

  it("follows the options as they are chosen one by one", async () => {
    const user = userEvent.setup();
    function WithAll() {
      const [chosen, setChosen] = useState<string[]>([]);
      return (
        <MultiSelect
          items={items}
          chosen={chosen}
          onChange={setChosen}
          allLabel="Все"
          placeholder="Ответственный"
          ariaLabel="Фильтр по ответственным"
        />
      );
    }
    render(<WithAll />);
    await open(user);

    const all = await screen.findByRole("menuitemcheckbox", { name: "Все" });
    expect(all).toHaveAttribute("aria-checked", "false");
    for (const name of ["Пётр", "Анна", "Не назначен"]) {
      await user.click(screen.getByRole("menuitemcheckbox", { name }));
    }
    expect(all).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("menuitemcheckbox", { name: "Анна" }));
    expect(all).toHaveAttribute("aria-checked", "false");
  });
});

describe("a multiple select with a search", () => {
  const searchable = () => render(
    <MultiSelect items={items} chosen={[]} onChange={() => {}} allLabel="Все" searchable placeholder="Ответственный" ariaLabel="Фильтр по ответственным" />,
  );

  it("has no search unless asked", async () => {
    show();
    await userEvent.click(trigger());

    expect(await screen.findAllByRole("menuitemcheckbox")).toHaveLength(3);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("narrows the items as the member types, leaving out the select-all item", async () => {
    searchable();
    await userEvent.click(trigger());
    expect(await screen.findAllByRole("menuitemcheckbox")).toHaveLength(4);

    await userEvent.type(screen.getByRole("searchbox", { name: "Поиск" }), "ан");

    const shown = screen.getAllByRole("menuitemcheckbox");
    expect(shown).toHaveLength(1);
    expect(shown[0]).toHaveTextContent("Анна");
  });

  it("says so when nothing matches", async () => {
    searchable();
    await userEvent.click(trigger());

    await userEvent.type(await screen.findByRole("searchbox", { name: "Поиск" }), "zzz");

    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    expect(screen.queryAllByRole("menuitemcheckbox")).toEqual([]);
  });
});
