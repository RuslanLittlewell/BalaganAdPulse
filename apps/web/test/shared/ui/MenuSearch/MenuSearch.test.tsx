import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  MenuSearch,
  MenuSearchEmpty,
  matchesSearch,
} from "@/shared/ui/index.js";

const NAMES = ["Архив", "Расход", "Показы", "CPC"];

function Menu() {
  const [query, setQuery] = useState("");
  const shown = NAMES.filter((name) => matchesSearch(name, query));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Столбцы</DropdownMenuTrigger>
      <DropdownMenuContent>
        <MenuSearch value={query} onChange={setQuery} />
        {shown.map((name) => (
          <DropdownMenuCheckboxItem
            key={name}
            checked={false}
            disabled={name === "Архив"}
            onSelect={(event) => event.preventDefault()}
          >
            {name}
          </DropdownMenuCheckboxItem>
        ))}
        {shown.length === 0 ? <MenuSearchEmpty /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

async function open() {
  const user = userEvent.setup();
  render(<Menu />);
  await user.click(screen.getByRole("button", { name: "Столбцы" }));
  return user;
}

const search = () => screen.getByRole("searchbox", { name: "Поиск" });

describe("matchesSearch", () => {
  it.each([
    ["Расход", "рас", true],
    ["Расход", "  РАС ", true],
    ["CPC", "cp", true],
    ["Показы", "", true],
    ["Показы", "   ", true],
    ["Показы", "рас", false],
  ])("matches %s against %j: %s", (label, query, expected) => {
    expect(matchesSearch(label, query)).toBe(expected);
  });
});

describe("MenuSearch", () => {
  it("holds the focus when the menu opens", async () => {
    await open();

    await waitFor(() => expect(search()).toHaveFocus());
  });

  it("keeps the focus while the member types a letter an item starts with", async () => {
    const user = await open();

    await user.keyboard("П");

    expect(search()).toHaveValue("П");
    expect(search()).toHaveFocus();
    expect(screen.queryByRole("menuitemcheckbox", { name: "Расход" })).toBeNull();
  });

  it("moves the focus to the first item that can be changed on the down arrow", async () => {
    const user = await open();

    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menuitemcheckbox", { name: "Расход" })).toHaveFocus();
  });

  it("says so when nothing matches", async () => {
    const user = await open();

    await user.keyboard("ябл");

    expect(screen.queryAllByRole("menuitemcheckbox")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Ничего не найдено");
  });

  it("lets Escape close the menu", async () => {
    const user = await open();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});
