import { Avatar as AvatarRoot, AvatarFallback } from "../ui/avatar.js";

const PALETTE_SIZE = 5;

const SIZES = {
  sm: { box: "size-8", text: "text-xs" },
  md: { box: "size-10", text: "text-sm" },
  lg: { box: "size-14", text: "text-lg" },
} as const;

export interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
}

function paletteIndex(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return (sum % PALETTE_SIZE) + 1;
}

export function Avatar({ name, size = "md" }: AvatarProps) {
  const initial = name.trim() ? name.trim()[0].toUpperCase() : "?";
  const background = `var(--color-avatar-${paletteIndex(name)})`;
  return (
    <AvatarRoot
      className={`${SIZES[size].box} shrink-0 rounded-md`}
      style={{ background }}
      aria-hidden="true"
    >
      <AvatarFallback
        className={`rounded-md bg-transparent font-semibold ${SIZES[size].text}`}
        style={{ color: "var(--color-avatar-ink)" }}
      >
        {initial}
      </AvatarFallback>
    </AvatarRoot>
  );
}
