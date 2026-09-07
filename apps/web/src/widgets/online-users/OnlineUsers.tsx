import { MemberAvatar } from "@/entities/membership/index.js";
import { usePresence, type OnlinePerson } from "@/entities/presence/index.js";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/index.js";

const SHOWN = 5;

export interface OnlineUsersProps {
  createSocket?: (url: string) => WebSocket;
}

export function OnlineUsers({ createSocket }: OnlineUsersProps) {
  const online = usePresence({ createSocket });
  const { user } = useAuth();

  const others = online.filter((person) => person.userId !== user?.id);
  if (others.length === 0) return null;

  const shown = others.slice(0, SHOWN);
  const rest = others.slice(SHOWN);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        data-testid="online-users"
        aria-label={t("presence.title")}
        className="flex items-center pr-1 pl-2"
      >
        {shown.map((person) => (
          <Face key={person.userId} person={person} />
        ))}
        {rest.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="-ml-2 grid size-8 shrink-0 place-items-center rounded-md border border-background bg-muted text-xs font-medium text-muted-foreground">
                +{rest.length}
              </span>
            </TooltipTrigger>
            <TooltipContent>{rest.map((person) => person.name).join(", ")}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function Face({ person }: { person: OnlinePerson }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="-ml-2 rounded-md border border-background first:ml-0">
          <MemberAvatar
            member={{ id: person.membershipId, name: person.name, image: person.image }}
            size="sm"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{person.name}</TooltipContent>
    </Tooltip>
  );
}
