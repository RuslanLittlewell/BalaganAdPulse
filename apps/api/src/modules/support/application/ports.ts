import type { ActorContext, Clock } from "#shared/application/index.js";
import type { Feedback, FeedbackSender } from "../domain/feedback.js";

export interface FeedbackSenders {
  describe(actor: ActorContext): Promise<FeedbackSender | null>;
}

export interface SupportMailbox {
  readonly address: string | null;
  readonly available: boolean;
  deliver(feedback: Feedback): Promise<void>;
}

export interface SupportDependencies {
  readonly senders: FeedbackSenders;
  readonly mailbox: SupportMailbox;
  readonly clock: Clock;
}
