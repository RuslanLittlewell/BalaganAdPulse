import { useState } from "react";
import { Avatar } from "@/shared/ui/index.js";
import type { Membership } from "../../api/api.js";

const SIZES = { sm: "size-8", md: "size-10", lg: "size-14" } as const;

export interface MemberAvatarProps {
  member: Pick<Membership, "id" | "name" | "image">;
  size?: keyof typeof SIZES;
}

/**
 * A member's picture, or their initial.
 *
 * `image` on a membership is only a marker that a picture exists — the bytes
 * live in object storage, and the value itself is the timestamp of the upload.
 * Rendering it as a `src` is what left every board card with a broken image.
 * The picture is fetched from its own endpoint instead; the session cookie
 * rides along with the request, so a plain `<img>` is enough.
 */
export function MemberAvatar({ member, size = "md" }: MemberAvatarProps) {
  // A marker can outlive the object it points at — storage cleared, a restore,
  // a half-finished upload. Falling back keeps a stale marker from showing a
  // broken image forever.
  const [failed, setFailed] = useState(false);

  if (!member.image || failed) return <Avatar name={member.name} size={size} />;

  return (
    <img
      className={`${SIZES[size]} shrink-0 rounded-md object-cover`}
      src={`/api/members/${member.id}/avatar`}
      alt={member.name}
      onError={() => setFailed(true)}
    />
  );
}
