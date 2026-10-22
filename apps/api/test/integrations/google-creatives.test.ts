import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client");
vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "secret");
vi.stubEnv("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost/api/integrations/google/callback");

const { createApp } = await import("../../src/composition/app.js");
const { prisma } = await import("../../src/shared/infrastructure/prisma.js");
const { resetDb, seedProject, seedCampaign } = await import("../helpers/db.js");
const { signInAs } = await import("../helpers/auth.js");
const { AesCredentialCipher } = await import("../../src/modules/integrations/infrastructure/credential-cipher.js");
const { S3CreativeFiles } = await import("../../src/modules/integrations/infrastructure/creative-files.js");
const { GoogleAdsProvider } = await import("../../src/modules/integrations/infrastructure/google-ads-provider.js");
const { ProviderError } = await import("../../src/modules/integrations/domain/integration.js");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const oauth = { accessToken: vi.fn(async () => "access") };
const ACCOUNT = { accountId: "222", loginCustomerId: "111" };

type Reply = unknown | ((query: string, init: RequestInit) => unknown);

function google(replies: { match: RegExp; reply: Reply }[]) {
  const queries: string[] = [];
  const fetcher = vi.fn(async (_input: URL | string, init: RequestInit) => {
    const query = JSON.parse(String(init.body ?? "{}")).query as string;
    queries.push(query);
    const found = replies.find(({ match }) => match.test(query));
    if (!found) throw new Error(`unexpected query: ${query}`);
    return json(typeof found.reply === "function" ? (found.reply as (...args: unknown[]) => unknown)(query, init) : found.reply);
  });
  return { fetcher, queries, provider: new GoogleAdsProvider(oauth, { apiVersion: "v24" }, fetcher as unknown as typeof fetch) };
}

const adRow = (ad: Record<string, unknown>) => ({ results: [{ adGroupAd: { ad: { id: "555", ...ad } } }] });
const AD_QUERY = /FROM ad_group_ad WHERE ad_group_ad\.ad\.id = 555/;
const ASSET_QUERY = /FROM asset WHERE asset\.resource_name IN/;
const image = (id: string, url: string) => ({
  asset: { resourceName: `customers/222/assets/${id}`, imageAsset: { fullSize: { url, widthPixels: "1200" } } },
});
const video = (id: string, youtubeId: string, title = "") => ({
  asset: { resourceName: `customers/222/assets/${id}`, youtubeVideoAsset: { youtubeVideoId: youtubeId, youtubeVideoTitle: title } },
});
const ref = (id: string) => ({ asset: `customers/222/assets/${id}` });
const read = (provider: InstanceType<typeof GoogleAdsProvider>) => provider.adCreatives("555", ACCOUNT, "refresh");

describe("reading an ad's creative from Google Ads", () => {
  it("gives an image ad its image under the ad's own name", async () => {
    const { provider } = google([{ match: AD_QUERY, reply: adRow({ imageAd: { imageUrl: "https://ads.example/full.png", previewImageUrl: "https://ads.example/preview.png", name: "Баннер" } }) }]);

    expect(await read(provider)).toEqual([
      { adExternalId: "555", creativeId: "image", position: 0, kind: "IMAGE", fileUrl: "https://ads.example/full.png", title: "Баннер" },
    ]);
  });

  it("falls back to the preview image, and drops an address that is not https", async () => {
    const { provider } = google([{ match: AD_QUERY, reply: adRow({ imageAd: { imageUrl: "http://ads.example/full.png", previewImageUrl: "https://ads.example/preview.png" } }) }]);
    expect((await read(provider)).map((creative) => creative.fileUrl)).toEqual(["https://ads.example/preview.png"]);

    const insecure = google([{ match: AD_QUERY, reply: adRow({ imageAd: { imageUrl: "http://ads.example/full.png" } }) }]);
    expect(await read(insecure.provider)).toEqual([]);
  });

  it("gives a responsive search ad one text creative, headlines and descriptions one per line, repeats left out", async () => {
    const { provider, queries } = google([{
      match: AD_QUERY,
      reply: adRow({
        responsiveSearchAd: {
          headlines: [{ text: "Окна от производителя" }, { text: " Скидка 20% " }, { text: "Окна от производителя" }, { text: "" }],
          descriptions: [{ text: "Замер бесплатно" }, { text: "Гарантия 5 лет" }],
        },
      }),
    }]);

    expect(await read(provider)).toEqual([{
      adExternalId: "555", creativeId: "text", position: 0, kind: "TEXT",
      title: "Окна от производителя\nСкидка 20%", body: "Замер бесплатно\nГарантия 5 лет",
    }]);
    expect(queries).toHaveLength(1);
  });

  it("gives an expanded text ad its headline and description parts", async () => {
    const { provider } = google([{
      match: AD_QUERY,
      reply: adRow({ expandedTextAd: { headlinePart1: "Одно", headlinePart2: "Два", description: "Описание", description2: "Ещё" } }),
    }]);

    expect(await read(provider)).toEqual([expect.objectContaining({ kind: "TEXT", title: "Одно\nДва", body: "Описание\nЕщё" })]);
  });

  it("gives a responsive display ad its marketing images before its square ones, its videos and its words last", async () => {
    const { provider, queries } = google([
      {
        match: AD_QUERY,
        reply: adRow({
          responsiveDisplayAd: {
            squareMarketingImages: [ref("3")],
            marketingImages: [ref("1"), ref("2")],
            youtubeVideos: [ref("9")],
            headlines: [{ text: "Кафе" }],
            longHeadline: { text: "Кафе у дома" },
            descriptions: [{ text: "Завтраки" }],
          },
        }),
      },
      {
        match: ASSET_QUERY,
        reply: { results: [image("2", "https://tpc.example/2"), image("1", "https://tpc.example/1"), image("3", "https://tpc.example/3"), video("9", "dQw4w9WgXcQ", "Ролик")] },
      },
    ]);

    const creatives = await read(provider);

    expect(creatives.map((creative) => [creative.position, creative.kind, creative.creativeId])).toEqual([
      [0, "IMAGE", "1"], [1, "IMAGE", "2"], [2, "IMAGE", "3"], [3, "VIDEO", "dQw4w9WgXcQ"], [4, "TEXT", "text"],
    ]);
    expect(creatives[0]).toMatchObject({ fileUrl: "https://tpc.example/1" });
    expect(creatives[3]).toEqual({
      adExternalId: "555", creativeId: "dQw4w9WgXcQ", position: 3, kind: "VIDEO", title: "Ролик",
      posterUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg", sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(creatives[4]).toMatchObject({ title: "Кафе\nКафе у дома", body: "Завтраки" });
    expect(queries[1]).toContain("'customers/222/assets/1'");
    expect(queries[1]).toMatch(/asset\.youtube_video_asset\.youtube_video_id/);
  });

  it("gives a video ad its YouTube video as a link and a thumbnail, with no file", async () => {
    const { provider } = google([
      { match: AD_QUERY, reply: adRow({ videoAd: { video: ref("7") } }) },
      { match: ASSET_QUERY, reply: { results: [video("7", "abcdefghijk")] } },
    ]);

    expect(await read(provider)).toEqual([{
      adExternalId: "555", creativeId: "abcdefghijk", position: 0, kind: "VIDEO",
      posterUrl: "https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg", sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    }]);
  });

  it("selects the video of a video ad by its asset, since Google refuses the video message itself", async () => {
    const { provider, queries } = google([{ match: AD_QUERY, reply: adRow({}) }]);

    await read(provider);

    expect(queries[0]).toContain("ad_group_ad.ad.video_ad.video.asset");
    expect(queries[0]).not.toMatch(/video_ad\.video(,|\s)/);
  });

  it("gives Demand Gen ads their images and videos", async () => {
    const images = google([
      { match: AD_QUERY, reply: adRow({ demandGenMultiAssetAd: { portraitMarketingImages: [ref("5")], marketingImages: [ref("4")], headlines: [{ text: "Новинка" }] } }) },
      { match: ASSET_QUERY, reply: { results: [image("4", "https://tpc.example/4"), image("5", "https://tpc.example/5")] } },
    ]);
    expect((await read(images.provider)).map((creative) => [creative.kind, creative.creativeId])).toEqual([["IMAGE", "4"], ["IMAGE", "5"], ["TEXT", "text"]]);

    const videos = google([
      { match: AD_QUERY, reply: adRow({ demandGenVideoResponsiveAd: { videos: [ref("6")], longHeadlines: [{ text: "Смотрите" }] } }) },
      { match: ASSET_QUERY, reply: { results: [video("6", "zzzzzzzzzzz")] } },
    ]);
    expect((await read(videos.provider)).map((creative) => creative.kind)).toEqual(["VIDEO", "TEXT"]);
  });

  it("gives a video responsive ad its videos and words", async () => {
    const { provider } = google([
      { match: AD_QUERY, reply: adRow({ videoResponsiveAd: { videos: [ref("8")], headlines: [{ text: "Заголовок" }], descriptions: [{ text: "Текст" }] } }) },
      { match: ASSET_QUERY, reply: { results: [video("8", "yyyyyyyyyyy", "Видео")] } },
    ]);

    expect((await read(provider)).map((creative) => [creative.kind, creative.title])).toEqual([["VIDEO", "Видео"], ["TEXT", "Заголовок"]]);
  });

  it("keeps at most eight images and four videos", async () => {
    const many = Array.from({ length: 12 }, (_, index) => String(100 + index));
    const { provider, queries } = google([
      { match: AD_QUERY, reply: adRow({ responsiveDisplayAd: { marketingImages: many.map(ref), youtubeVideos: ["201", "202", "203", "204", "205", "206"].map(ref) } }) },
      {
        match: ASSET_QUERY,
        reply: { results: [
          ...many.map((id) => image(id, `https://tpc.example/${id}`)),
          ...["201", "202", "203", "204", "205", "206"].map((id) => video(id, `video${id}${id}`)),
        ] },
      },
    ]);

    const creatives = await read(provider);

    expect(creatives.filter((creative) => creative.kind === "IMAGE")).toHaveLength(8);
    expect(creatives.filter((creative) => creative.kind === "VIDEO")).toHaveLength(4);
    expect((queries[1]!.match(/customers\/222\/assets\//g) ?? []).length).toBe(12);
  });

  it("skips an asset it cannot describe, and a video id that is not one", async () => {
    const { provider } = google([
      { match: AD_QUERY, reply: adRow({ responsiveDisplayAd: { marketingImages: [ref("1"), ref("2")], youtubeVideos: [ref("9")] } }) },
      { match: ASSET_QUERY, reply: { results: [image("1", "http://tpc.example/1"), image("2", "https://tpc.example/2"), video("9", "no spaces!")] } },
    ]);

    expect((await read(provider)).map((creative) => creative.creativeId)).toEqual(["2"]);
  });

  it("reads back nothing for an ad that is gone, one of a kind it does not read, or one with nothing to show", async () => {
    expect(await read(google([{ match: AD_QUERY, reply: { results: [] } }]).provider)).toEqual([]);
    expect(await read(google([{ match: AD_QUERY, reply: adRow({ demandGenCarouselAd: { businessName: "Кафе" } }) }]).provider)).toEqual([]);
    expect(await read(google([{ match: AD_QUERY, reply: adRow({}) }]).provider)).toEqual([]);
  });

  it("asks through the connection's manager account and refuses an address that is not a number", async () => {
    const { provider, fetcher } = google([{ match: AD_QUERY, reply: adRow({}) }]);

    await read(provider);
    expect(String(fetcher.mock.calls[0]![0])).toContain("/customers/222/googleAds:search");
    expect((fetcher.mock.calls[0]![1].headers as Record<string, string>)["login-customer-id"]).toBe("111");

    await expect(provider.adCreatives("555 OR 1=1", ACCOUNT, "refresh")).rejects.toBeInstanceOf(ProviderError);
    await expect(provider.adCreatives("555", { accountId: "x", loginCustomerId: null }, "refresh")).rejects.toBeInstanceOf(ProviderError);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("raises an access error the way the import does", async () => {
    const fetcher = vi.fn(async () => json({ error: { status: "PERMISSION_DENIED" } }, 403));
    const provider = new GoogleAdsProvider(oauth, { apiVersion: "v24" }, fetcher as unknown as typeof fetch);

    await expect(read(provider)).rejects.toMatchObject({ code: "ACCESS" });
  });
});

const app = createApp();
let auth: { Authorization: string };
let projectId: string;
let adId: string;

describe("opening a Google ad's preview", () => {
  beforeEach(async () => {
    await resetDb();
    const member = await signInAs();
    ({ auth } = member);
    ({ projectId } = await seedProject(member.user.id));
    const campaign = await seedCampaign(projectId, "Поиск", "GOOGLE");
    await prisma.campaign.update({ where: { id: campaign.id }, data: { externalId: "900", sourceAccountId: "222" } });
    const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Группа", position: 0 } });
    adId = (await prisma.ad.create({ data: { adSetId: adSet.id, name: "Объявление", externalId: "555", position: 0 } })).id;
    await prisma.projectIntegration.create({
      data: {
        projectId, provider: "GOOGLE", accountId: "222", loginCustomerId: "111", currency: "BYN", timezone: "UTC",
        encryptedToken: new AesCredentialCipher(process.env.INTEGRATION_ENCRYPTION_KEY).encrypt("refresh-token", projectId),
        revision: "v1", nextDailyAt: new Date(),
      },
    });
  });
  afterAll(async () => { vi.restoreAllMocks(); await prisma.$disconnect(); });

  it("reads the creative through the connection once, copies images and thumbnails, and keeps text and links as they are", async () => {
    const reader = vi.spyOn(GoogleAdsProvider.prototype, "adCreatives").mockResolvedValue([
      { adExternalId: "555", creativeId: "1", position: 0, kind: "IMAGE", fileUrl: "https://tpc.example/1" },
      {
        adExternalId: "555", creativeId: "dQw4w9WgXcQ", position: 1, kind: "VIDEO", title: "Ролик",
        posterUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg", sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      { adExternalId: "555", creativeId: "text", position: 2, kind: "TEXT", title: "Окна\nДвери", body: "Замер бесплатно" },
    ]);
    const copied = vi.spyOn(S3CreativeFiles.prototype, "copy")
      .mockImplementation(async (url) => ({ key: `creatives/${url.slice(-6)}`, contentType: "image/jpeg", bytes: 10 }));

    const res = await request(app).get(`/api/ads/${adId}/creatives`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(String), position: 0, kind: "IMAGE", title: null, body: null, hasFile: true, hasPoster: false, sourceUrl: null },
      {
        id: expect.any(String), position: 1, kind: "VIDEO", title: "Ролик", body: null, hasFile: false, hasPoster: true,
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      { id: expect.any(String), position: 2, kind: "TEXT", title: "Окна\nДвери", body: "Замер бесплатно", hasFile: false, hasPoster: false, sourceUrl: null },
    ]);
    expect(reader).toHaveBeenCalledWith("555", { accountId: "222", loginCustomerId: "111" }, "refresh-token");
    expect(copied.mock.calls.map(([url, kind]) => [url, kind])).toEqual([
      ["https://tpc.example/1", "IMAGE"],
      ["https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg", "IMAGE"],
    ]);

    const again = await request(app).get(`/api/ads/${adId}/creatives`).set(auth);
    expect(again.body).toHaveLength(3);
    expect(reader).toHaveBeenCalledOnce();
  });

  it("answers with an empty list for an ad Google describes no creative for", async () => {
    vi.spyOn(GoogleAdsProvider.prototype, "adCreatives").mockResolvedValue([]);

    const res = await request(app).get(`/api/ads/${adId}/creatives`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
