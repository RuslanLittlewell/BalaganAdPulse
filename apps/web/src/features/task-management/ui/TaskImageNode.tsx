import { useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Paperclip } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { TaskImagePreview } from "./TaskImagePreview.js";

/**
 * Where this node sits among the description's images.
 *
 * Counted from the document rather than stored on the node, so deleting the
 * second of three renumbers the rest by itself. A stored ordinal would have to
 * be rewritten across every later node on each edit, and would drift the first
 * time that failed.
 */
function attachmentNumber(editor: NodeViewProps["editor"], pos: number | undefined): number {
  if (pos === undefined) return 1;
  let seen = 0;
  editor.state.doc.descendants((candidate, candidatePos) => {
    if (candidate.type.name !== "taskImage") return true;
    if (candidatePos < pos) seen += 1;
    return false;
  });
  return seen + 1;
}

/**
 * An image in the description, shown as a reference to the attachment rather
 * than as the picture itself.
 *
 * The file belongs in the attachments block; the description points at it. Full
 * pictures inline are unreadable at the width a task dialog gives them, and
 * draw the same bytes twice on a task with several of them.
 *
 * The bytes are still fetched here, and only when the preview is opened: an
 * object URL is valid for exactly one page load, so a description that stored
 * one would come back to a broken picture the next time the task was opened.
 */
function TaskImageView({ node, editor, getPos }: NodeViewProps) {
  const imageId = node.attrs.imageId as string | null;
  const [open, setOpen] = useState(false);
  const number = attachmentNumber(editor, typeof getPos === "function" ? getPos() : undefined);
  const label = `${t("tasks.editor.attachment")} ${number}`;

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block align-baseline"
      data-task-image={imageId ?? undefined}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-baseline gap-1 rounded border border-border bg-muted/50 px-1.5 py-0 align-baseline text-sm leading-snug text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Paperclip aria-hidden className="size-3.5 text-muted-foreground" />
        <span className="underline underline-offset-2">{label}</span>
      </button>

      <TaskImagePreview imageId={imageId} label={label} open={open} onOpenChange={setOpen} />
    </NodeViewWrapper>
  );
}

/**
 * The document keeps the id; everything else is drawn from it.
 *
 * Inline, so the reference sits in the sentence that mentions it rather than
 * interrupting it — a block node is lifted out of the paragraph by the schema
 * and breaks the text either side of it onto separate lines.
 */
export const TaskImage = Node.create({
  name: "taskImage",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return { imageId: { default: null } };
  },

  parseHTML() {
    // Both shapes: descriptions written before the node became inline were
    // serialised as a div.
    return [{ tag: "span[data-task-image]" }, { tag: "div[data-task-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-task-image": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskImageView);
  },
});
