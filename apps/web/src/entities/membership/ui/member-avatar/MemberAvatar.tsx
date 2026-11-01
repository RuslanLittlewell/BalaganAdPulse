import { useState } from "react";
import { Avatar } from "@/shared/ui/index.js";
import type { Membership } from "../../api/api.js";

const SIZES = { sm: "size-6", md: "size-8", lg: "size-11" } as const;

export interface MemberAvatarProps {
  member: Pick<Membership, "id" | "name" | "image">;
  size?: keyof typeof SIZES;
}

export function MemberAvatar({ member, size = "md" }: MemberAvatarProps) {
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
