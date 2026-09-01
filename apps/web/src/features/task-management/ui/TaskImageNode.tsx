import { useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { taskImagesApi } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";

/**
 * Resolves the image every time it is shown.
 *
 * The document stores only the image's id. An object URL is valid for exactly
 * one page load, so a description that stored one would come back to a broken
 * picture the next time the task was opened — which is precisely what happened
 * before. The bytes are fetched with the member's token and turned into a fresh
 * URL here, revoked when the node goes away.
 */
function TaskImageView({ node }: NodeViewProps) {
  const imageId = node.attrs.imageId as string | null;
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!imageId) return;
    let url: string | null = null;
    let cancelled = false;

    taskImagesApi
      .blobUrl(imageId)
      .then((resolved) => {
        if (cancelled) { URL.revokeObjectURL(resolved); return; }
        url = resolved;
        setSrc(resolved);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageId]);

  return (
    <NodeViewWrapper className="my-2" data-task-image={imageId ?? undefined}>
      {src ? (
        <img src={src} alt="" className="max-w-full rounded-md border" />
      ) : (
        <span className="text-xs text-muted-foreground">
          {failed ? t("tasks.editor.uploadFailed") : t("tasks.editor.uploading")}
        </span>
      )}
    </NodeViewWrapper>
  );
}

/** The document keeps the id; the bytes are fetched when the node is drawn. */
export const TaskImage = Node.create({
  name: "taskImage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return { imageId: { default: null } };
  },

  parseHTML() {
    return [{ tag: "div[data-task-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-task-image": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskImageView);
  },
});
