import { useEffect } from "react";
import { create } from "zustand";
import { membersApi, type Membership } from "../api/api.js";

export type StaffStatus = "idle" | "loading" | "ready" | "failed";

interface StaffStore {
  members: Membership[] | undefined;
  status: StaffStatus;
}

export const useStaffStore = create<StaffStore>(() => ({
  members: undefined,
  status: "idle",
}));

let session = 0;
let loading: Promise<void> | null = null;

export function loadStaff(): Promise<void> {
  if (loading) return loading;
  if (useStaffStore.getState().status === "ready") return Promise.resolve();

  const era = session;
  useStaffStore.setState({ status: "loading" });
  loading = membersApi.list()
    .then((members) => {
      if (era === session) useStaffStore.setState({ members, status: "ready" });
    })
    .catch(() => {
      if (era === session) useStaffStore.setState({ status: "failed" });
    })
    .finally(() => {
      if (era === session) loading = null;
    });

  return loading;
}

export function resetStaff(): void {
  session += 1;
  loading = null;
  useStaffStore.setState({ members: undefined, status: "idle" });
}

export function useMembers() {
  const members = useStaffStore((state) => state.members);
  const status = useStaffStore((state) => state.status);

  useEffect(() => { void loadStaff(); }, []);

  return {
    data: members,
    isPending: status === "idle" || status === "loading",
    isSuccess: status === "ready",
    isError: status === "failed",
  };
}
