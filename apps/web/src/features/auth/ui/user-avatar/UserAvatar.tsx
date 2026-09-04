import { UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../api.js";

export interface UserAvatarProps {
  userId: string;
  name: string;
  version?: number;
}

const FRAME =
  "grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted object-cover text-muted-foreground";

export function UserAvatar({ userId, name, version }: UserAvatarProps) {
  const profile = useQuery({
    queryKey: ["user", "profile", userId, version],
    queryFn: authApi.profile,
  });

  const image = profile.data?.image;
  if (image != null) return <img className={FRAME} src={image} alt={name} />;

  return (
    <div className={FRAME} role="img" aria-label={name}>
      <UserRound aria-hidden="true" />
    </div>
  );
}
