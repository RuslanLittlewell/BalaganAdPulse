import { useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Paperclip } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { TaskImagePreview } from "./TaskImagePreview.js";

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
    return [{ tag: "span[data-task-image]" }, { tag: "div[data-task-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-task-image": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskImageView);
  },
});
