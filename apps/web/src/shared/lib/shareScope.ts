import { createContext, useContext } from "react";

export interface ShareScope {
  readonly token: string;
  readonly projectId: string;
}

let scopedToken: string | null = null;

export function enterShareScope(token: string): void {
  scopedToken = token;
}

export function leaveShareScope(): void {
  scopedToken = null;
}

export function sharedToken(): string | null {
  return scopedToken;
}

export const ShareScopeContext = createContext<ShareScope | null>(null);

export function useShareScope(): ShareScope | null {
  return useContext(ShareScopeContext);
}
