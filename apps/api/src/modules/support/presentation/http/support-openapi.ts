import { z } from "zod";
import { ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { FEEDBACK_TOPICS, MAX_FEEDBACK_MESSAGE_LENGTH, MAX_SCREENSHOTS } from "#modules/support/domain/feedback.js";

const supportContacts = z.object({
  email: z.email().nullable(),
  feedback: z.boolean(),
});

export const supportComponents: ComponentDocs = {
  SupportContacts: supportContacts,
};

export const supportDoc: RouteDoc = {
  tag: "Support",
  tagDescription: "The help and feedback dialog: the support address and the feedback form",
  operations: [
    {
      method: "get",
      path: "/contacts",
      summary: "Read the support address",
      description: "The address set in SUPPORT_EMAIL, or null, and whether feedback can be sent now.",
      success: { status: 200, description: "The support contacts", schema: ref("SupportContacts") },
      errors: [401, 403],
    },
    {
      method: "post",
      path: "/feedback",
      summary: "Send feedback to support",
      description: "Up to three PNG, JPEG or WebP files of at most 5 MB under `screenshots`. One email goes to SUPPORT_EMAIL with the screenshots attached and the sender's email as the reply-to address. The organization, the sender, the role and the tariff come from the session. Open on an expired trial. Five messages per person in ten minutes.",
      bodyType: "multipart/form-data",
      body: {
        type: "object",
        properties: {
          topic: { type: "string", enum: [...FEEDBACK_TOPICS] },
          message: { type: "string", minLength: 1, maxLength: MAX_FEEDBACK_MESSAGE_LENGTH },
          page: { type: "string", maxLength: 2000 },
          userAgent: { type: "string", maxLength: 1000 },
          screen: { type: "string", maxLength: 40 },
          screenshots: { type: "array", maxItems: MAX_SCREENSHOTS, items: { type: "string", format: "binary" } },
        },
        required: ["topic", "message"],
      },
      success: { status: 202, description: "The mail server accepted the message" },
      errors: [400, 401, 403, 429, 503],
    },
  ],
};
