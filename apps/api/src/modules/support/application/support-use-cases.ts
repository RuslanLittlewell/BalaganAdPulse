import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import {
  MAX_SCREENSHOT_BYTES,
  MAX_SCREENSHOTS,
  screenshotType,
  type ClientContext,
  type FeedbackTopic,
  type Screenshot,
} from "../domain/feedback.js";
import type { SupportDependencies } from "./ports.js";

export const FEEDBACK_UNAVAILABLE = "Feedback cannot be sent right now; write to the support email instead";

export interface FeedbackInput {
  readonly topic: FeedbackTopic;
  readonly message: string;
  readonly context: ClientContext;
  readonly files: readonly Buffer[];
}

function screenshotsOf(files: readonly Buffer[]): Screenshot[] {
  if (files.length > MAX_SCREENSHOTS) {
    throw new AppError("validation", `At most ${MAX_SCREENSHOTS} screenshots can be attached`);
  }
  return files.map((bytes) => {
    if (bytes.length > MAX_SCREENSHOT_BYTES) {
      throw new AppError("validation", "A screenshot is too large; the limit is 5 MB");
    }
    const type = screenshotType(bytes);
    if (!type) throw new AppError("validation", "Only PNG, JPEG and WebP screenshots can be attached");
    return { bytes, type };
  });
}

export function createSupportUseCases(dependencies: SupportDependencies) {
  return {
    contacts: () => ({
      email: dependencies.mailbox.address,
      feedback: dependencies.mailbox.available,
    }),

    sendFeedback: async (actor: ActorContext, input: FeedbackInput): Promise<void> => {
      const screenshots = screenshotsOf(input.files);
      if (!dependencies.mailbox.available) throw new AppError("unavailable", FEEDBACK_UNAVAILABLE);
      const sender = await dependencies.senders.describe(actor);
      if (!sender) throw new AppError("forbidden", "Only a member of an organization may send feedback");
      try {
        await dependencies.mailbox.deliver({
          topic: input.topic,
          message: input.message,
          context: input.context,
          sender,
          screenshots,
          sentAt: dependencies.clock.now(),
        });
      } catch (error) {
        console.error("Failed to send feedback to support:", error);
        throw new AppError("unavailable", FEEDBACK_UNAVAILABLE);
      }
    },
  };
}

export type SupportUseCases = ReturnType<typeof createSupportUseCases>;
