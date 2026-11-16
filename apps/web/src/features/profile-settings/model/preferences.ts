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
}
