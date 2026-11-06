import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_SCREENSHOTS = 3;
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export interface AttachedScreenshot {
  readonly id: number;
  readonly file: File;
  readonly url: string;
}

export type ScreenshotRefusal = "invalid" | "full";

export const acceptsScreenshot = (file: File) =>
  (SCREENSHOT_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_SCREENSHOT_BYTES;

export function useScreenshots() {
  const [screenshots, setScreenshots] = useState<AttachedScreenshot[]>([]);
  const next = useRef(0);
  const current = useRef(screenshots);
  current.current = screenshots;

  useEffect(() => () => { current.current.forEach(({ url }) => URL.revokeObjectURL(url)); }, []);

  const add = useCallback((file: File): ScreenshotRefusal | null => {
    if (!acceptsScreenshot(file)) return "invalid";
    if (current.current.length >= MAX_SCREENSHOTS) return "full";
    next.current += 1;
    const attached = { id: next.current, file, url: URL.createObjectURL(file) };
    current.current = [...current.current, attached];
    setScreenshots(current.current);
    return null;
  }, []);

  const remove = useCallback((id: number) => {
    const gone = current.current.find((screenshot) => screenshot.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    current.current = current.current.filter((screenshot) => screenshot.id !== id);
    setScreenshots(current.current);
  }, []);

  const clear = useCallback(() => {
    current.current.forEach(({ url }) => URL.revokeObjectURL(url));
    current.current = [];
    setScreenshots([]);
  }, []);

  return { screenshots, add, remove, clear, full: screenshots.length >= MAX_SCREENSHOTS };
}
