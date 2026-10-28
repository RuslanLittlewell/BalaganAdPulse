import { z } from "zod";
import { richTextProblem, type RichTextParts } from "#shared/domain/rich-text.js";

export const TITLE_LIMIT = 500;
export const DETAIL_LIMIT = 300;
export const NAME_LIMIT = 200;
export const HANDLE_LIMIT = 100;

export const atMost = (limit: number) => `must be at most ${limit} characters`;

export function richText(parts: RichTextParts) {
  return z.unknown().superRefine((value, context) => {
    const problem = richTextProblem(value, parts);
    if (problem) context.addIssue({ code: "custom", message: problem });
  });
}
