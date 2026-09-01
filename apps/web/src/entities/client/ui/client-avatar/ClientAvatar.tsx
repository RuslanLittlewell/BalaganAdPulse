import { Avatar } from "@/shared/ui/index.js";
import type { Client } from "../../api/api.js";

const SIZES = { sm: "size-8", md: "size-10", lg: "size-14" } as const;

export interface ClientAvatarProps {
  client: Client;
  size?: keyof typeof SIZES;
}

/** The client's picture when it has one, its initial otherwise. The picture
 * travels inside the client, so there is nothing to fetch here. */
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
