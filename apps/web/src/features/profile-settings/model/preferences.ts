import { useSyncExternalStore } from "react";

const CHANGED = "adpulse:campaign-crm";

const storageKey = (userId: string) => `adpulse.profile.${userId}.campaignCrm`;

export function readCampaignCrm(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === "true";
  } catch {
    return false;
  }
}

export function saveCampaignCrm(userId: string, enabled: boolean): void {
  localStorage.setItem(storageKey(userId), String(enabled));
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useCampaignCrm(userId: string | undefined): boolean {
  return useSyncExternalStore(subscribe, () => (userId ? readCampaignCrm(userId) : false), () => false);
}
