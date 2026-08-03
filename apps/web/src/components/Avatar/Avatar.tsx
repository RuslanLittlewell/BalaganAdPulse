import styles from "./Avatar.module.css";

const PALETTE_SIZE = 5;

export interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
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
    <span className={styles.avatar} data-size={size} style={{ background }} aria-hidden="true">
      {initial}
    </span>
  );
}
