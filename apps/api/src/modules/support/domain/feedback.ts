import type { Role, Tariff } from "@adpulse/access-policy";

export const FEEDBACK_TOPICS = ["PROBLEM", "IMPROVEMENT", "QUESTION", "TARIFF", "AD_ACCOUNTS", "OTHER"] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

export const TOPIC_TITLES: Readonly<Record<FeedbackTopic, string>> = {
  PROBLEM: "Сообщить о проблеме",
  IMPROVEMENT: "Предложить улучшение",
  QUESTION: "Вопрос по работе сервиса",
  TARIFF: "Тариф и оплата",
  AD_ACCOUNTS: "Подключение рекламных кабинетов",
  OTHER: "Другое",
};

export const MAX_FEEDBACK_MESSAGE_LENGTH = 5000;
export const MAX_SCREENSHOTS = 3;
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export type ScreenshotType = "image/png" | "image/jpeg" | "image/webp";

export const SCREENSHOT_EXTENSIONS: Readonly<Record<ScreenshotType, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);

export function screenshotType(bytes: Buffer): ScreenshotType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG)) return "image/png";
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(JPEG)) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export interface FeedbackSender {
  readonly name: string;
  readonly email: string | null;
  readonly login: string | null;
  readonly role: Role;
  readonly organization: string;
  readonly tariff: Tariff;
}

export interface ClientContext {
  readonly page: string | null;
  readonly userAgent: string | null;
  readonly screen: string | null;
}

export interface Screenshot {
  readonly bytes: Buffer;
  readonly type: ScreenshotType;
}

export interface Feedback {
  readonly topic: FeedbackTopic;
  readonly message: string;
  readonly context: ClientContext;
  readonly sender: FeedbackSender;
  readonly screenshots: readonly Screenshot[];
  readonly sentAt: Date;
}
