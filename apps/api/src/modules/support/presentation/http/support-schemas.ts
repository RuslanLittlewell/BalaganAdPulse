import { z } from "zod";
import { FEEDBACK_TOPICS, MAX_FEEDBACK_MESSAGE_LENGTH } from "#modules/support/domain/feedback.js";

const optionalText = (max: number) => z.string().trim().max(max).optional()
  .transform((value) => value || null);

export const feedbackSchema = z.object({
  topic: z.enum(FEEDBACK_TOPICS),
  message: z.string().trim().min(1, "message is required").max(MAX_FEEDBACK_MESSAGE_LENGTH),
  page: optionalText(2000),
  userAgent: optionalText(1000),
  screen: optionalText(40),
});
