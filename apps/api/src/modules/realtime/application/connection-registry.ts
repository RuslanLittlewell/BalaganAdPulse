import type { SessionPrincipal } from "../../identity/index.js";
import type { TaskEvent } from "../../tasks/index.js";

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
  clear(): void;
}

export function createConnectionRegistry(): ConnectionRegistry {
  const connections = new Set<Connection>();
  return {
    add(connection) {
      connections.add(connection);
      return { remove: () => { connections.delete(connection); } };
    },
    list: () => [...connections],
    size: () => connections.size,
    clear: () => { connections.clear(); },
  };
}
