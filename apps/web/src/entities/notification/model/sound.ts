import soundUrl from "@/shared/assets/notification.wav?url";

export const SOUND_CLAIM_KEY = "adpulse.notification-sound";
export const HIDDEN_TAB_DELAY_MS = 250;

let audio: HTMLAudioElement | null = null;

function claimedElsewhere(key: string): boolean {
  try {
    if (localStorage.getItem(SOUND_CLAIM_KEY) === key) return true;
    localStorage.setItem(SOUND_CLAIM_KEY, key);
  } catch {
  }
  return false;
}

function play(): void {
  audio ??= new Audio(soundUrl);
  audio.currentTime = 0;
  try {
    void Promise.resolve(audio.play()).catch(() => undefined);
  } catch {
  }
}

export function soundNotification(key: string): void {
  const sound = () => {
    if (!claimedElsewhere(key)) play();
  };
  if (document.visibilityState === "visible") sound();
  else setTimeout(sound, Math.random() * HIDDEN_TAB_DELAY_MS);
}
