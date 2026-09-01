import type { SessionPrincipal } from "../../identity/index.js";
import type { TaskEvent } from "../../tasks/index.js";

/** One live subscriber. The principal is who authenticated; what they are
 * *allowed* to receive is decided per event, not stored here. */
export interface Connection {
  readonly principal: SessionPrincipal;
  send(event: TaskEvent): void;
}

export interface ConnectionHandle {
  remove(): void;
}

export interface ConnectionRegistry {
  add(connection: Connection): ConnectionHandle;
  list(): readonly Connection[];
  size(): number;
  /** Every open connection, for the shutdown drain. */
  clear(): void;
}

/**
 * Who is currently listening — nothing more.
 *
 * Deliberately without rooms or topics. A room keyed by organization or project
 * would be a second copy of the authorization rules, and it would go stale the
 * moment a grant changed: the member would keep receiving a project they had
 * just lost. Subscription is implicit in being connected, and every question
 * about who may see what is answered at delivery time.
 */
export function createConnectionRegistry(): ConnectionRegistry {
  const connections = new Set<Connection>();
  return {
    add(connection) {
      connections.add(connection);
      // Idempotent: a socket that errors and then closes removes twice.
      return { remove: () => { connections.delete(connection); } };
    },
    // Copied, so a connection closing during a delivery cannot mutate the set
    // being iterated.
    list: () => [...connections],
    size: () => connections.size,
    clear: () => { connections.clear(); },
  };
}
