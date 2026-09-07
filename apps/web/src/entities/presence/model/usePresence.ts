import { useEffect, useState } from "react";
import { openRealtimeChannel, type RealtimeMessage } from "@/shared/lib/index.js";

export interface OnlinePerson {
  userId: string;
  membershipId: string;
  name: string;
  image: string | null;
}

export interface PresenceOptions {
  createSocket?: (url: string) => WebSocket;
}

const rosterOf = (message: RealtimeMessage): OnlinePerson[] | null => {
  const { people } = message as { people?: unknown };
  return Array.isArray(people) ? (people as OnlinePerson[]) : null;
};

const personOf = (message: RealtimeMessage): OnlinePerson | null => {
  const { person } = message as { person?: unknown };
  return person && typeof person === "object" ? (person as OnlinePerson) : null;
};

export function usePresence(options: PresenceOptions = {}): OnlinePerson[] {
  const [online, setOnline] = useState<OnlinePerson[]>([]);
  const createSocket = options.createSocket;

  useEffect(() => {
    const channel = openRealtimeChannel({
      createSocket,
      onMessage: (message) => {
        if (message.kind === "presence.state") {
          const people = rosterOf(message);
          if (people) setOnline(people);
          return;
        }
        if (message.kind === "presence.joined") {
          const person = personOf(message);
          if (person) {
            setOnline((current) => [
              ...current.filter((who) => who.userId !== person.userId),
              person,
            ]);
          }
          return;
        }
        if (message.kind === "presence.left") {
          const { userId } = message as { userId?: unknown };
          if (typeof userId === "string") {
            setOnline((current) => current.filter((who) => who.userId !== userId));
          }
        }
      },
    });

    return () => { channel.close(); };
  }, [createSocket]);

  return online;
}
