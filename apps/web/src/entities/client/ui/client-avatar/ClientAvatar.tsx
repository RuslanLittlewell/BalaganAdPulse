import { Avatar } from "@/shared/ui/index.js";
import type { Client } from "../../api/api.js";

const SIZES = { sm: "size-8", md: "size-10", lg: "size-14" } as const;

export interface ClientAvatarProps {
  client: Client;
  size?: keyof typeof SIZES;
}

export function ClientAvatar({ client, size = "md" }: ClientAvatarProps) {
  if (!client.image) return <Avatar name={client.name} size={size} />;

  return (
    <img
      className={`${SIZES[size]} shrink-0 rounded-md object-cover`}
      src={client.image}
      alt={client.name}
    />
  );
}
