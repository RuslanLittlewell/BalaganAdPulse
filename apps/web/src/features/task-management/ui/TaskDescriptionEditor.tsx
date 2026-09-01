import type React from "react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskImage } from "./TaskImageNode.js";
import { taskImagesApi } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";

export interface TaskDescriptionEditorProps {
  value: unknown | null;
  onChange: (value: unknown) => void;
}

export interface TaskDescriptionEditorHandle {
  /** Drops every reference to one image from the text. */
  removeImage(imageId: string): void;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * The description, with images pasted or dropped straight into it.
 *
 * An image is uploaded as it lands and the document keeps only its id — the
 * bytes never travel inside a task payload. Rendering fetches them with the
 * member's token and shows them from an object URL, because an `<img src>`
 * pointing at the API would carry no credentials.
 */
export const TaskDescriptionEditor = forwardRef<
  TaskDescriptionEditorHandle,
  TaskDescriptionEditorProps
>(function TaskDescriptionEditor({ value, onChange }, ref) {
  const [status, setStatus] = useState<string | null>(null);
  // Captured on the first render and never updated. Rebuilding the editor when
  // the value changes would tear down the DOM node holding the caret — which is
  // exactly what made the first keystroke lose focus, since it is the keystroke
  // that turns an empty description into a document.
  const [initialContent] = useState(value);

  // The editor reads these through a ref rather than through the closure it was
  // built with, so the instance never has to be rebuilt to see a new one.
  const report = useRef(onChange);
  report.current = onChange;

  const editor = useEditor({
    extensions: [StarterKit, TaskImage],
    // Read once, at mount. The dialog mounts a fresh editor per task, so this
    // is always the description being opened.
    content: (initialContent as never) ?? "",
    onUpdate: ({ editor: instance }) => report.current(instance.getJSON()),
    editorProps: {
      attributes: {
        "aria-label": t("tasks.form.description"),
        // Grows with the text, then scrolls: past this a long description
        // pushes the dialog's own buttons out of reach.
        class: "min-h-32 max-h-[400px] overflow-y-auto p-3 outline-none",
      },
      handlePaste: (_view, event) => insertFrom(event.clipboardData?.files),
    },
  });

  /**
   * A command rather than a prop, because the editor is uncontrolled: it reads
   * its content once so that the first keystroke cannot rebuild it and steal
   * focus. Deleting an attachment therefore has to be pushed in, or the link
   * stays on screen and saving writes the dead reference straight back.
   */
  useImperativeHandle(ref, () => ({
    removeImage(imageId: string) {
      if (!editor) return;
      const positions: number[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "taskImage" && node.attrs.imageId === imageId) positions.push(pos);
        return true;
      });
      if (positions.length === 0) return;
      const transaction = editor.state.tr;
      // Back to front: deleting shifts every position after it.
      for (const pos of positions.reverse()) {
        transaction.delete(transaction.mapping.map(pos), transaction.mapping.map(pos + 1));
      }
      editor.view.dispatch(transaction);
    },
  }), [editor]);

  function insertFrom(files: FileList | undefined | null): boolean {
    const file = files?.[0];
    // Not an image: let ProseMirror handle it as it normally would, which is
    // what keeps pasted text pasting as text.
    if (!file || !file.type.startsWith("image/")) return false;

    void upload(file);
    return true;
  }

  async function upload(file: Blob & { type: string }) {
    if (!ACCEPTED.includes(file.type)) { setStatus(t("tasks.editor.wrongType")); return; }
    if (file.size > MAX_BYTES) { setStatus(t("tasks.editor.tooLarge")); return; }

    setStatus(t("tasks.editor.uploading"));
    try {
      const image = await taskImagesApi.upload(file);
      // Only the id goes into the document; the node view fetches the bytes,
      // now and on every later open.
      editor?.chain().focus()
        .insertContent({ type: "taskImage", attrs: { imageId: image.id } })
        .run();
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof ApiError ? error.message : t("tasks.editor.uploadFailed"));
    }
  }

  /** Drop is handled here rather than through ProseMirror: the editor's own
   * hook needs a resolved drop position, and a file dropped anywhere on the
   * editor should land in the description wherever the cursor happens to be. */
  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    insertFrom(event.dataTransfer.files);
  }

  return (
    <div
      className="rounded-md border"
      onDrop={handleDrop}
      onDragOver={(event) => { if (event.dataTransfer?.types?.includes("Files")) event.preventDefault(); }}
    >
      <EditorContent editor={editor} data-testid="task-description-editor" />
      {status ? <p role="status" className="border-t p-2 text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
});
