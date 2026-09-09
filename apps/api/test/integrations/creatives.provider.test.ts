import { expect, it, vi } from "vitest";
import { GraphProvider } from "../../src/modules/integrations/infrastructure/graph-provider.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const account = { account_id: "123", currency: "USD", timezone_name: "UTC" };

function graph(ads: unknown[], videos: Record<string, unknown> = {}) {
  const fetcher = vi.fn(async (url: URL) => {
    const path = url.pathname;
    if (path.endsWith("/act_123")) return json(account);
    if (path.endsWith("/ads")) return json({ data: ads });
    if (path.endsWith("/insights")) return json({ data: [] });
    const video = Object.entries(videos).find(([id]) => path.endsWith(`/${id}`));
    if (video) return json(video[1]);
    const known = ads.find((entry) => path.endsWith(`/${(entry as { id: string }).id}`));
    if (known) return json(known);
    return json({ data: [] });
  });
  return { fetcher, provider: new GraphProvider("v22.0", fetcher) };
}

const ad = (creative: unknown) => ({
  id: "10", name: "Объявление", effective_status: "ACTIVE", adset_id: "2", creative,
});

it("carries a single image creative with the ad it belongs to", async () => {
  const { provider, fetcher } = graph([ad({
    id: "c1", image_url: "https://cdn.invalid/full.jpg", thumbnail_url: "https://cdn.invalid/small.jpg",
  })]);

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives).toEqual([{
    adExternalId: "10", creativeId: "c1", position: 0, kind: "IMAGE",
    fileUrl: "https://cdn.invalid/full.jpg",
  }]);
  const selectedAd = fetcher.mock.calls.map(([url]) => url as URL)
    .find((url) => url.pathname.endsWith("/10"));
  expect(selectedAd?.searchParams.get("fields")).toContain("creative");
  expect(fetcher.mock.calls.map(([url]) => (url as URL).pathname)).not.toContain("/v22.0/act_123/ads");
});

it("carries one entry per carousel frame, in order", async () => {
  const { provider } = graph([ad({
    id: "c2",
    object_story_spec: {
      link_data: {
        name: "Заголовок",
        message: "Текст",
        child_attachments: [
          { picture: "https://cdn.invalid/one.jpg" },
          { picture: "https://cdn.invalid/two.jpg" },
        ],
      },
    },
  })]);

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives.map((creative) => [creative.position, creative.fileUrl])).toEqual([
    [0, "https://cdn.invalid/one.jpg"],
    [1, "https://cdn.invalid/two.jpg"],
  ]);
  expect(creatives[0]).toMatchObject({ kind: "IMAGE", title: "Заголовок", body: "Текст" });
});

it("resolves a video creative to its source and poster", async () => {
  const { provider } = graph(
    [ad({ id: "c3", video_id: "77", thumbnail_url: "https://cdn.invalid/poster.jpg" })],
    { 77: { id: "77", source: "https://cdn.invalid/movie.mp4" } },
  );

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives).toEqual([{
    adExternalId: "10", creativeId: "c3", position: 0, kind: "VIDEO",
    fileUrl: "https://cdn.invalid/movie.mp4", posterUrl: "https://cdn.invalid/poster.jpg",
  }]);
});

it("keeps a video without a readable source, with its poster alone", async () => {
  const { provider } = graph(
    [ad({ id: "c4", video_id: "78", thumbnail_url: "https://cdn.invalid/poster.jpg" })],
    { 78: { id: "78" } },
  );

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives).toEqual([{
    adExternalId: "10", creativeId: "c4", position: 0, kind: "VIDEO",
    posterUrl: "https://cdn.invalid/poster.jpg",
  }]);
});

it("imports an ad whose creative it cannot describe, carrying no creative", async () => {
  const { provider } = graph([ad({ id: "c5" }), { id: "11", name: "Без креатива", effective_status: "ACTIVE", adset_id: "2" }]);

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives).toEqual([]);
});

it("ignores a creative shaped in a way it does not understand", async () => {
  const { provider } = graph([ad({ id: "c6", object_story_spec: { link_data: { child_attachments: "нет" } } })]);

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives).toEqual([]);
});

it("carries what the provider answered, without the token, for the log", async () => {
  const failing = new GraphProvider("v22.0", vi.fn(async () =>
    json({ error: { code: 17, type: "OAuthException", message: "User request limit reached" } }, 400)));

  await expect(failing.account("123", "secret")).rejects.toMatchObject({
    code: "PROVIDER",
    detail: "http 400, code 17, type OAuthException",
  });
});

it("falls back to a lighter creative request when the heavy one is refused", async () => {
  const asked: string[] = [];
  const fetcher = vi.fn(async (url: URL) => {
    if (url.pathname.endsWith("/act_123")) return json(account);
    if (url.pathname.endsWith("/insights")) return json({ data: [] });
    if (url.pathname.endsWith("/10")) {
      const fields = url.searchParams.get("fields") ?? "";
      asked.push(fields);
      return fields.includes("object_story_spec")
        ? json({ error: { code: 1 } }, 500)
        : json({ id: "10", creative: { id: "c9", thumbnail_url: "https://cdn.invalid/small.jpg" } });
    }
    return json({ data: [] });
  });

  const creatives = await new GraphProvider("v22.0", fetcher).adCreatives("10", "secret");

  expect(asked).toHaveLength(2);
  expect(creatives).toEqual([{
    adExternalId: "10", creativeId: "c9", position: 0, kind: "IMAGE",
    fileUrl: "https://cdn.invalid/small.jpg",
  }]);
});

it("prefers the full picture over the small thumbnail", async () => {
  const { provider } = graph([ad({
    id: "c7",
    thumbnail_url: "https://cdn.invalid/tiny.jpg",
    object_story_spec: { link_data: { picture: "https://cdn.invalid/full.jpg" } },
  })]);

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives[0]).toMatchObject({ fileUrl: "https://cdn.invalid/full.jpg" });
});

it("keeps the thumbnail when nothing better is offered", async () => {
  const { provider } = graph([ad({ id: "c10", thumbnail_url: "https://cdn.invalid/tiny.jpg" })]);

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives[0]).toMatchObject({ fileUrl: "https://cdn.invalid/tiny.jpg" });
});

it("reads the videos of a dynamic creative, each with its poster", async () => {
  const { provider } = graph(
    [ad({
      id: "c12",
      thumbnail_url: "https://cdn.invalid/tiny.jpg",
      asset_feed_spec: {
        videos: [
          { video_id: "801", thumbnail_url: "https://cdn.invalid/poster-1.jpg" },
          { video_id: "802", thumbnail_url: "https://cdn.invalid/poster-2.jpg" },
        ],
      },
    })],
    { 801: { id: "801", source: "https://cdn.invalid/one.mp4" }, 802: { id: "802", source: "https://cdn.invalid/two.mp4" } },
  );

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives).toEqual([
    { adExternalId: "10", creativeId: "c12", position: 0, kind: "VIDEO", fileUrl: "https://cdn.invalid/one.mp4", posterUrl: "https://cdn.invalid/poster-1.jpg" },
    { adExternalId: "10", creativeId: "c12", position: 1, kind: "VIDEO", fileUrl: "https://cdn.invalid/two.mp4", posterUrl: "https://cdn.invalid/poster-2.jpg" },
  ]);
});

it("reads the images of a dynamic creative", async () => {
  const { provider } = graph([ad({
    id: "c13",
    thumbnail_url: "https://cdn.invalid/tiny.jpg",
    asset_feed_spec: { images: [{ hash: "h1", url: "https://cdn.invalid/big.jpg" }] },
  })]);

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives).toEqual([{
    adExternalId: "10", creativeId: "c13", position: 0, kind: "IMAGE",
    fileUrl: "https://cdn.invalid/big.jpg",
  }]);
});

it("asks for the dynamic creative specification only for the selected ad", async () => {
  const { provider, fetcher } = graph([ad({ id: "c14", thumbnail_url: "https://cdn.invalid/tiny.jpg" })]);

  await provider.adCreatives("10", "secret");

  const withCreatives = fetcher.mock.calls.map(([url]) => url as URL)
    .find((url) => url.pathname.endsWith("/10"));
  expect(withCreatives?.searchParams.get("fields")).toContain("asset_feed_spec");
  expect(fetcher.mock.calls.map(([url]) => (url as URL).pathname)).not.toContain("/v22.0/act_123/ads");
});

it("asks for a large thumbnail rather than the default tiny one", async () => {
  const { provider, fetcher } = graph([ad({ id: "c15", thumbnail_url: "https://cdn.invalid/tiny.jpg" })]);

  await provider.adCreatives("10", "secret");

  const asked = fetcher.mock.calls.map(([url]) => url as URL)
    .find((url) => url.pathname.endsWith("/10"));
  expect(asked?.searchParams.get("thumbnail_width")).toBe("1080");
  expect(asked?.searchParams.get("thumbnail_height")).toBe("1080");
});

it("prefers the video's own picture over a small asset poster", async () => {
  const { provider } = graph(
    [ad({
      id: "c16",
      asset_feed_spec: { videos: [{ video_id: "901", thumbnail_url: "https://cdn.invalid/s160.jpg" }] },
    })],
    { 901: { id: "901", source: "https://cdn.invalid/clip.mp4", picture: "https://cdn.invalid/large.jpg" } },
  );

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives[0]).toMatchObject({
    kind: "VIDEO",
    fileUrl: "https://cdn.invalid/clip.mp4",
    posterUrl: "https://cdn.invalid/large.jpg",
  });
});

it("keeps the asset poster when the video offers none", async () => {
  const { provider } = graph(
    [ad({ id: "c17", asset_feed_spec: { videos: [{ video_id: "902", thumbnail_url: "https://cdn.invalid/s160.jpg" }] } })],
    { 902: { id: "902", source: "https://cdn.invalid/clip.mp4" } },
  );

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives[0]).toMatchObject({ posterUrl: "https://cdn.invalid/s160.jpg" });
});

it("reads an ad's rendered preview and keeps only the frame address", async () => {
  const fetcher = vi.fn(async () => json({
    data: [{ body: '<iframe src="https://business.facebook.com/ads/api/preview_iframe.php?d=AQ&amp;t=XY" width="335" height="450"></iframe>' }],
  }));

  const url = await new GraphProvider("v22.0", fetcher).preview("10", "secret");

  expect(url).toBe("https://business.facebook.com/ads/api/preview_iframe.php?d=AQ&t=XY");
  const asked = new URL(fetcher.mock.calls[0][0] as URL);
  expect(asked.pathname).toBe("/v22.0/10/previews");
  expect(asked.searchParams.get("ad_format")).toBe("MOBILE_FEED_STANDARD");
  expect(asked.searchParams.has("access_token")).toBe(false);
});

it("gives nothing back when the provider will not render the ad", async () => {
  const refused = new GraphProvider("v22.0", vi.fn(async () => json({ error: { code: 100 } }, 400)));
  expect(await refused.preview("10", "secret")).toBeNull();

  const empty = new GraphProvider("v22.0", vi.fn(async () => json({ data: [] })));
  expect(await empty.preview("10", "secret")).toBeNull();

  const shapeless = new GraphProvider("v22.0", vi.fn(async () => json({ data: [{ body: "<div>no frame</div>" }] })));
  expect(await shapeless.preview("10", "secret")).toBeNull();
});

it("keeps one entry per distinct video, however many placements reuse it", async () => {
  const { provider } = graph(
    [ad({
      id: "c18",
      asset_feed_spec: {
        videos: [
          { video_id: "701", thumbnail_url: "https://cdn.invalid/a.jpg" },
          { video_id: "701", thumbnail_url: "https://cdn.invalid/a.jpg" },
          { video_id: "702", thumbnail_url: "https://cdn.invalid/b.jpg" },
        ],
      },
    })],
    { 701: { id: "701", source: "https://cdn.invalid/one.mp4" }, 702: { id: "702", source: "https://cdn.invalid/two.mp4" } },
  );

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives.map((entry) => [entry.position, entry.fileUrl])).toEqual([
    [0, "https://cdn.invalid/one.mp4"],
    [1, "https://cdn.invalid/two.mp4"],
  ]);
});

it("keeps one entry per distinct image of a dynamic creative", async () => {
  const { provider } = graph([ad({
    id: "c19",
    asset_feed_spec: {
      images: [
        { hash: "h1", url: "https://cdn.invalid/one.jpg" },
        { hash: "h1", url: "https://cdn.invalid/one.jpg" },
      ],
    },
  })]);

  const creatives = await provider.adCreatives("10", "secret");

  expect(creatives).toHaveLength(1);
});

it("reads the creatives of one ad on its own", async () => {
  const fetcher = vi.fn(async (url: URL) => {
    if (url.pathname.endsWith("/10")) {
      return json({ id: "10", creative: { id: "c20", image_url: "https://cdn.invalid/one.jpg" } });
    }
    return json({ data: [] });
  });

  const creatives = await new GraphProvider("v22.0", fetcher).adCreatives("10", "secret");

  expect(creatives).toEqual([{
    adExternalId: "10", creativeId: "c20", position: 0, kind: "IMAGE",
    fileUrl: "https://cdn.invalid/one.jpg",
  }]);
  const asked = new URL(fetcher.mock.calls[0][0] as URL);
  expect(asked.searchParams.get("thumbnail_width")).toBe("1080");
});

it("gives an empty list when one ad's creative cannot be read", async () => {
  const refused = new GraphProvider("v22.0", vi.fn(async () => json({ error: { code: 100 } }, 400)));
  expect(await refused.adCreatives("10", "secret")).toEqual([]);
});

it("keeps creative fields out of the daily snapshot", async () => {
  const fetcher = vi.fn(async (url: URL) => {
    if (url.pathname.endsWith("/act_123")) return json(account);
    if (url.pathname.endsWith("/campaigns")) {
      return json({ data: [{ id: "1", name: "Campaign", effective_status: "ACTIVE" }] });
    }
    if (url.pathname.endsWith("/adsets")) {
      return json({ data: [{ id: "2", campaign_id: "1", name: "Set", effective_status: "ACTIVE" }] });
    }
    if (url.pathname.endsWith("/ads")) {
      return json({ data: [{
        id: "10", adset_id: "2", name: "Ad", effective_status: "ACTIVE",
        creative: { id: "c1", image_url: "https://cdn.invalid/banner.jpg" },
      }] });
    }
    if (url.pathname.endsWith("/insights")) return json({ data: [] });
    return json({ data: [] });
  });

  const snapshot = await new GraphProvider("v22.0", fetcher)
    .snapshot("123", "secret", "USD", new Date("2026-09-08T01:00:00Z"));

  expect(snapshot.ads).toHaveLength(1);
  const adsRequest = fetcher.mock.calls.map(([url]) => url as URL)
    .find((url) => url.pathname.endsWith("/ads"));
  expect(adsRequest?.searchParams.get("fields")).not.toContain("creative");
  expect(fetcher.mock.calls.map(([url]) => (url as URL).pathname)).not.toContain("/v22.0/10");
});
