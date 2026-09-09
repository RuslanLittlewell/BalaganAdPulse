import { METRIC_COLUMNS, channelLabel, performanceTone, statusLabel } from "@/entities/campaign/index.js";
import { CHANNELS, DELIVERY_STATUSES } from "@/entities/campaign/index.js";

const performance = {
  spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5,
};

describe("channel and status names", () => {
  it("names every channel the API can send", () => {
    expect(CHANNELS.map(channelLabel)).toEqual([
      "Meta", "Google Ads", "Яндекс Директ", "VK Реклама", "TikTok", "LinkedIn", "Telegram Ads",
    ]);
  });

  it("names every delivery status in Russian", () => {
    expect(DELIVERY_STATUSES.map(statusLabel)).toEqual([
      "Активна", "Обучение", "Пауза", "Отклонена", "Завершена",
    ]);
  });
});

describe("campaign performance tone", () => {
  it.each([
    [0.6, "danger"],
    [0.9, "stable"],
    [1.2, "stable"],
    [1.21, "profitable"],
    [null, "stable"],
  ] as const)("maps ROAS %s to %s", (roas, tone) => {
    expect(performanceTone({ ...performance, roas })).toBe(tone);
  });
});

describe("the metric columns", () => {
  it("lists the five measured figures before the six derived ratios", () => {
    expect(METRIC_COLUMNS.map((column) => column.id)).toEqual([
      "spend", "impressions", "reach", "clicks", "conversions",
      "ctr", "cpc", "cpm", "cpa", "roas", "frequency",
    ]);
  });

  it("formats each figure the way its unit reads", () => {
    const rendered = Object.fromEntries(
      METRIC_COLUMNS.map((column) => [column.id, column.format(performance, "RUB")]),
    );

    expect(rendered.spend).toBe("1 000 ₽");
    expect(rendered.clicks).toBe("2 000");
    expect(rendered.ctr).toBe("2,00%");
    expect(rendered.cpc).toBe("0,50 ₽");
    expect(rendered.roas).toBe("4,00x");
    expect(rendered.frequency).toBe("2,50x");
  });

  it("prices every money figure in the currency it is handed", () => {
    const rendered = Object.fromEntries(
      METRIC_COLUMNS.map((column) => [column.id, column.format(performance, "BYN")]),
    );

    expect(rendered.spend).toBe("1 000 Br");
    expect(rendered.cpc).toBe("0,50 Br");
    expect(rendered.cpm).toBe("10,00 Br");
    expect(rendered.cpa).toBe("20,00 Br");
  });

  it("renders an absent ratio as a dash", () => {
    const noClicks = { ...performance, cpc: null, ctr: null };
    const cpc = METRIC_COLUMNS.find((column) => column.id === "cpc");

    expect(cpc?.format(noClicks, "BYN")).toBe("—");
  });
});
