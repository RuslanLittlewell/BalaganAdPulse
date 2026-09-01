import type { ReactNode } from "react";
import type { Action, Resource } from "@adpulse/access-policy";
import { useCan } from "../model/useCan.js";

interface CanProps {
  action: Action;
  resource: Resource;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ action, resource, children, fallback = null }: CanProps) {
  return useCan(action, resource) ? children : fallback;
}
