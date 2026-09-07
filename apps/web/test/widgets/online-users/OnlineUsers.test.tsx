import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@test/shared/index.js";
import { OnlineUsers } from "@/widgets/online-users/index.js";

class FakeSocket {
  static opened: FakeSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) { FakeSocket.opened.push(this); }
  close() { this.closed = true; }
}

const latest = () => FakeSocket.opened[FakeSocket.opened.length - 1]!;
const createSocket = (url: string) => new FakeSocket(url) as unknown as WebSocket;

const someone = (id: string, name: string) => ({
  userId: `u${id}`,
  membershipId: `m${id}`,
  name,
  image: "2026-09-01T00:00:00.000Z",
});

async function setup(people: ReturnType<typeof someone>[]) {
  renderWithProviders(<OnlineUsers createSocket={createSocket} />);
  await waitFor(() => { expect(FakeSocket.opened).toHaveLength(1); });
  latest().onmessage?.({ data: JSON.stringify({ kind: "presence.state", people }) });
}

beforeEach(() => { FakeSocket.opened = []; });

describe("the people online in the header", () => {
  it("stands each of them behind an avatar, with no names on show", async () => {
    await setup([someone("2", "Мария"), someone("3", "Пётр")]);

    expect(await screen.findByRole("img", { name: "Мария" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Пётр" })).toBeInTheDocument();
    expect(screen.queryByText("Мария")).not.toBeInTheDocument();
  });

  it("gives the name up on hover", async () => {
    await setup([someone("2", "Мария")]);

    await userEvent.hover(await screen.findByRole("img", { name: "Мария" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Мария");
  });

  it("leaves the viewer out of their own roster", async () => {
    await setup([
      { ...someone("ser-1", "Buyer"), userId: "user-1" },
      someone("2", "Мария"),
    ]);

    expect(await screen.findByRole("img", { name: "Мария" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("img", { name: "Buyer" })).not.toBeInTheDocument();
    });
  });

  it("counts the surplus rather than widening the header", async () => {
    await setup(["2", "3", "4", "5", "6", "7", "8"].map((id) => someone(id, `Имя ${id}`)));

    expect(await screen.findByText("+2")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });

  it("takes up no room when nobody else is online", async () => {
    await setup([]);

    await waitFor(() => {
      expect(screen.queryByTestId("online-users")).not.toBeInTheDocument();
    });
  });
});
