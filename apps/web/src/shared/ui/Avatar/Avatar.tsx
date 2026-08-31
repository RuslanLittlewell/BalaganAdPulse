import { Avatar as AvatarRoot, AvatarFallback } from "../ui/avatar.js";

const PALETTE_SIZE = 5;

/**
 * The box and the letter inside it, per size.
 *
 * Deliberately not shadcn's own `size` prop: it drives `data-[size=…]` variants
 * whose attribute selector outranks a plain `size-*` class, so passing both
 * left `lg` rendering at shadcn's 40px while the picture beside it — a plain
 * `<img>` — was 56. Setting the classes and leaving `data-size` alone keeps one
 * source for the number.
 */
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

/** shadcn's Avatar as a rounded square, with the app's rule for what fills it:
 * the first letter of the name, on a colour derived from the name so the same
 * client always looks the same. */
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
