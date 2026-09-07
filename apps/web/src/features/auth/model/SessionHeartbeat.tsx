import { useEffect } from "react";
import { authApi } from "../api.js";

export const SESSION_HEARTBEAT_MS = 2 * 60_000;

export interface SessionHeartbeatProps {
  everyMs?: number;
}

export function SessionHeartbeat({ everyMs = SESSION_HEARTBEAT_MS }: SessionHeartbeatProps) {
  useEffect(() => {
    const beat = setInterval(() => { void authApi.session().catch(() => {}); }, everyMs);
    return () => { clearInterval(beat); };
  }, [everyMs]);

  return null;
}
