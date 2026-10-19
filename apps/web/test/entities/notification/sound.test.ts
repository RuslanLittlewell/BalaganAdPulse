import { HIDDEN_TAB_DELAY_MS, SOUND_CLAIM_KEY, soundNotification } from "@/entities/notification/index.js";

let play: ReturnType<typeof vi.spyOn>;

function showTab(visibility: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibility);
}

beforeEach(() => {
  localStorage.removeItem(SOUND_CLAIM_KEY);
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  showTab("visible");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the notification sound", () => {
  it("plays at once in a visible tab, and once per notification", () => {
    soundNotification("n1@2026-10-19T12:00:00.000Z");
    soundNotification("n1@2026-10-19T12:00:00.000Z");

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays again for a notification refreshed by a later change", () => {
    soundNotification("n1@2026-10-19T12:00:00.000Z");
    soundNotification("n1@2026-10-19T12:05:00.000Z");

    expect(play).toHaveBeenCalledTimes(2);
  });

  it("stays silent when another tab has already played it", () => {
    localStorage.setItem(SOUND_CLAIM_KEY, "n1@2026-10-19T12:00:00.000Z");

    soundNotification("n1@2026-10-19T12:00:00.000Z");

    expect(play).not.toHaveBeenCalled();
  });

  it("lets a visible tab go first when it is hidden", async () => {
    vi.useFakeTimers();
    showTab("hidden");

    soundNotification("n2@2026-10-19T12:00:00.000Z");
    expect(play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(HIDDEN_TAB_DELAY_MS);

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("stays silent in a hidden tab when the visible one played it in the meantime", async () => {
    vi.useFakeTimers();
    showTab("hidden");

    soundNotification("n3@2026-10-19T12:00:00.000Z");
    localStorage.setItem(SOUND_CLAIM_KEY, "n3@2026-10-19T12:00:00.000Z");
    await vi.advanceTimersByTimeAsync(HIDDEN_TAB_DELAY_MS);

    expect(play).not.toHaveBeenCalled();
  });

  it("shrugs off a browser that refuses to play", async () => {
    play.mockRejectedValue(new DOMException("Not allowed", "NotAllowedError"));

    expect(() => soundNotification("n4@2026-10-19T12:00:00.000Z")).not.toThrow();
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);
  });
});
