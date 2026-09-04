import { useMemo } from "react";
import { can, type Action, type Actor, type Resource } from "@adpulse/access-policy";
import { useAuth } from "@/features/auth/index.js";

export function useCan(action: Action, resource: Resource): boolean {
  const { user, organization, role } = useAuth();

  return useMemo(() => {
    if (!user || !organization || !role) return false;

    const actor: Actor = {
      userId: user.id,
      membershipId: "",
      orgId: organization.id,
      role,
    };
    return can(actor, action, resource);
  }, [action, organization, resource, role, user]);
}
