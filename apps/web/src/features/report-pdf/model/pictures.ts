import { campaignsApi } from "@/entities/campaign/index.js";
import { reportsApi, type Report } from "@/entities/report/index.js";
import { COVER_PICTURE } from "./slides.js";

function toPng(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("No canvas"));
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Unreadable picture"));
    image.src = source;
  });
}

async function converted(url: string): Promise<string> {
  try {
    return await toPng(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadCover(report: Report): Promise<string | null> {
  try {
    return await converted(await reportsApi.cover(report.projectId, report.id));
  } catch {
    return null;
  }
}

export async function loadPicture(adId: string): Promise<string | null> {
  try {
    const creatives = await campaignsApi.adCreatives(adId);
    const creative = creatives.find((candidate) =>
      (candidate.kind === "IMAGE" && candidate.hasFile) || candidate.hasPoster);
    if (!creative) return null;
    const part = creative.kind === "IMAGE" && creative.hasFile ? "file" : "poster";
    return await converted(await campaignsApi.creativeFile(creative.id, part));
  } catch {
    return null;
  }
}

export async function loadPictures(report: Report): Promise<Map<string, string>> {
  const adIds = [...new Set(report.ads.map((ad) => ad.adId))];
  const [cover, ...ads] = await Promise.all([
    report.hasCover ? loadCover(report) : Promise.resolve(null),
    ...adIds.map(loadPicture),
  ]);
  const pictures = new Map<string, string>();
  if (cover) pictures.set(COVER_PICTURE, cover);
  adIds.forEach((adId, index) => { const picture = ads[index]; if (picture) pictures.set(adId, picture); });
  return pictures;
}
