import { useMutation, useQuery } from "@tanstack/react-query";
import { http } from "@/shared/lib/index.js";

export const FEEDBACK_TOPICS = ["PROBLEM", "IMPROVEMENT", "QUESTION", "TARIFF", "AD_ACCOUNTS", "OTHER"] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

export interface SupportContacts {
  email: string | null;
  feedback: boolean;
}

export interface FeedbackInput {
  topic: FeedbackTopic;
  message: string;
  page: string;
  userAgent: string;
  screen: string;
  screenshots: readonly File[];
}

export const supportApi = {
  contacts: () => http.get<SupportContacts>("/support/contacts"),
  sendFeedback: (input: FeedbackInput) => {
    const form = new FormData();
    form.append("topic", input.topic);
    form.append("message", input.message);
    form.append("page", input.page);
    form.append("userAgent", input.userAgent);
    form.append("screen", input.screen);
    for (const screenshot of input.screenshots) form.append("screenshots", screenshot, screenshot.name);
    return http.postForm<void>("/support/feedback", form);
  },
};

export const supportContactsKey = ["support", "contacts"] as const;

export function useSupportContacts(enabled: boolean) {
  return useQuery({ queryKey: supportContactsKey, queryFn: supportApi.contacts, enabled, staleTime: 5 * 60 * 1000 });
}

export function useSendFeedback() {
  return useMutation({ mutationFn: supportApi.sendFeedback });
}
