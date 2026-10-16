import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils.js";

export interface DropzoneProps {
  label: string;
  accept: readonly string[];
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  onFile: (file: File) => void;
}

const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

export function Dropzone({ label, accept, disabled = false, className, children, onFile }: DropzoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const open = () => {
    if (!disabled) input.current?.click();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || !carriesFiles(event)) return;
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  };

  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      data-dragging={dragging ? "" : undefined}
      onClick={open}
      onKeyDown={onKeyDown}
      onDragEnter={onDragEnter}
      onDragOver={(event) => { if (!disabled && carriesFiles(event)) event.preventDefault(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        "data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:ring-offset-2",
        disabled && "cursor-default opacity-60",
        className,
      )}
    >
      {children}
      <input
        ref={input}
        type="file"
        accept={accept.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
