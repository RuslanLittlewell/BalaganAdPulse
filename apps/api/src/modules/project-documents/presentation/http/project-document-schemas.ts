import { z } from "zod";
import { STARTER_MARKS, STARTER_NODES } from "#shared/domain/rich-text.js";
import { NAME_LIMIT, atMost, richText } from "#shared/presentation/input-schemas.js";

const title = z.string().max(NAME_LIMIT, `title ${atMost(NAME_LIMIT)}`);

export const createDocumentSchema = z.object({ title }).strict();

export const updateDocumentSchema = z.object({
  title: title.optional(),
  content: richText({ nodes: STARTER_NODES, marks: [...STARTER_MARKS, "link"] }).nullable().optional(),
}).strict();
