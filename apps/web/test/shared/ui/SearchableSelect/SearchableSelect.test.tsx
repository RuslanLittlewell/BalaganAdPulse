import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchableSelect } from "@/shared/ui/index.js";

const options = [
  { value: "p1", label: "Клиника" },
  { value: "p2", label: "Автосалон" },
  { value: "p3", label: "Кафе Ромашка" },
];

function Harness({ initial = "all", onChange = (_value: string) => {} }) {
  const [value, setValue] = useState(initial);
  return (
    <SearchableSelect
      value={value}
      onValueChange={(next) => { setValue(next); onChange(next); }}
      pinned={[{ value: "all", label: "Все проекты" }]}
      options={options}
      searchLabel="Поиск"
      emptyLabel="Ничего не найдено"
      ariaLabel="Проект"
    />
  );
}

const trigger = () => screen.getByRole("combobox", { name: "Проект" });
const optionNames = () => screen.queryAllByRole("option").map((option) => option.textContent);

describe("a select with a search", () => {
  it("shows the chosen option, then a search field and every option when opened", async () => {
    render(<Harness initial="p2" />);

    expect(trigger()).toHaveTextContent("Автосалон");
    await userEvent.click(trigger());

    expect(await screen.findByRole("searchbox", { name: "Поиск" })).toBeInTheDocument();
    expect(optionNames()).toEqual(["Все проекты", "Клиника", "Автосалон", "Кафе Ромашка"]);
  });

  it("narrows the options as the member types, whatever the case, and leaves out the pinned one", async () => {
    render(<Harness />);
    await userEvent.click(trigger());

    await userEvent.type(await screen.findByRole("searchbox", { name: "Поиск" }), "РОМ");

    expect(optionNames()).toEqual(["Кафе Ромашка"]);
    expect(screen.getByRole("combobox", { name: "Проект", hidden: true })).toHaveTextContent("Все проекты");
  });

  it("chooses an option by pointer", async () => {
    const chosen: string[] = [];
    render(<Harness onChange={(value) => chosen.push(value)} />);
    await userEvent.click(trigger());
    await userEvent.type(await screen.findByRole("searchbox", { name: "Поиск" }), "авто");

    await userEvent.click(screen.getByRole("option", { name: "Автосалон" }));

    expect(chosen).toEqual(["p2"]);
    expect(trigger()).toHaveTextContent("Автосалон");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("chooses the first match with Enter", async () => {
    const chosen: string[] = [];
    render(<Harness onChange={(value) => chosen.push(value)} />);
    await userEvent.click(trigger());

    await userEvent.type(await screen.findByRole("searchbox", { name: "Поиск" }), "к{Enter}");

    expect(chosen).toEqual(["p1"]);
    expect(trigger()).toHaveTextContent("Клиника");
  });

  it("says so when nothing matches, and chooses nothing on Enter", async () => {
    const chosen: string[] = [];
    render(<Harness onChange={(value) => chosen.push(value)} />);
    await userEvent.click(trigger());

    await userEvent.type(await screen.findByRole("searchbox", { name: "Поиск" }), "zzz{Enter}");

    expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
    expect(optionNames()).toEqual([]);
    expect(chosen).toEqual([]);
  });

  it("starts a fresh search each time it is opened", async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    await userEvent.type(await screen.findByRole("searchbox", { name: "Поиск" }), "кафе");
    await userEvent.keyboard("{Escape}");

    await userEvent.click(trigger());

    expect(await screen.findByRole("searchbox", { name: "Поиск" })).toHaveValue("");
    expect(optionNames()).toHaveLength(4);
  });

  it("keeps typing out of the select's own letter search", async () => {
    render(<Harness />);
    await userEvent.click(trigger());
    const search = await screen.findByRole("searchbox", { name: "Поиск" });

    await userEvent.type(search, "кли");

    expect(search).toHaveValue("кли");
    expect(within(screen.getByRole("listbox")).getByRole("searchbox")).toBe(search);
  });
});
