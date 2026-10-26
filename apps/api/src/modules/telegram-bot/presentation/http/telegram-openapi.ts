import { z } from "zod";
import type { RouteDoc } from "#shared/presentation/openapi.js";
import { telegramSettingsSchema } from "./telegram-http.js";

const statusSchema = z.object({
  available: z.boolean(),
  linked: z.boolean(),
  username: z.string().nullable(),
  linkedAt: z.iso.datetime().nullable(),
  notifications: z.boolean(),
});

const linkSchema = z.object({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});

export const telegramDoc: RouteDoc = {
  tag: "Telegram bot",
  tagDescription:
    "The Telegram bot that turns a voice or text message into a task. It is offered to an organization's admins and managers when the Tasks module is on and the server has a bot token and a Groq API key. A member links their Telegram by opening a one-time link to the bot and pressing Start.",
  operations: [
    {
      method: "get",
      path: "/",
      summary: "Whether the bot is offered to the caller and whether their Telegram is linked",
      success: { status: 200, description: "The caller's bot status", schema: statusSchema },
      errors: [401],
    },
    {
      method: "patch",
      path: "/",
      summary: "Turn the caller's notifications in Telegram on or off",
      description: "While on, every new in-app notification of the caller is also sent to their linked chat. It is on for a new link.",
      body: telegramSettingsSchema,
      success: { status: 200, description: "The caller's bot status", schema: statusSchema },
      errors: [400, 401, 404],
    },
    {
      method: "post",
      path: "/link",
      summary: "Issue the caller a one-time link to the bot",
      description: "The link holds a token valid for 15 minutes and replaces any link issued before.",
      success: { status: 201, description: "The link and when it expires", schema: linkSchema },
      errors: [401, 404],
    },
    {
      method: "delete",
      path: "/link",
      summary: "Unlink the caller's Telegram",
      success: { status: 204, description: "No Telegram chat is linked to the caller" },
      errors: [401],
    },
  ],
};
