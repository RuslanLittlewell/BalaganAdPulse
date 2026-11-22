import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/lib/index.js";

export interface TwoFactorStatus {
  enabled: boolean;
  required: boolean;
  backupCodesLeft: number;
}

export interface TwoFactorSetup {
  key: string;
  uri: string;
  qrSvg: string;
}

export interface TrustedAddress {
  id: string;
  address: string;
  confirmedAt: string;
  lastUsedAt: string;
}

export interface OrganizationTwoFactor {
  required: boolean;
  enrolledMembershipIds: string[];
}

const ROOT = ["two-factor"] as const;

export function useTwoFactorStatus({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...ROOT, "status"],
    queryFn: ({ signal }) => http.get<TwoFactorStatus>("/two-factor", { signal }),
    enabled,
  });
}

export function useTrustedAddresses(enabled: boolean) {
  return useQuery({
    queryKey: [...ROOT, "addresses"],
    queryFn: ({ signal }) => http.get<TrustedAddress[]>("/two-factor/addresses", { signal }),
    enabled,
  });
}

export function useTwoFactorChanges() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ROOT });
  return {
    setup: useMutation({ mutationFn: () => http.post<TwoFactorSetup>("/two-factor/setup", {}) }),
    confirm: useMutation({
      mutationFn: (code: string) => http.post<{ backupCodes: string[] }>("/two-factor/confirm", { code }),
    }),
    disable: useMutation({ mutationFn: (code: string) => http.post<void>("/two-factor/disable", { code }), onSuccess: refresh }),
    renew: useMutation({
      mutationFn: (code: string) => http.post<{ backupCodes: string[] }>("/two-factor/backup-codes", { code }),
      onSuccess: refresh,
    }),
    forget: useMutation({ mutationFn: (id: string) => http.del(`/two-factor/addresses/${encodeURIComponent(id)}`), onSuccess: refresh }),
    forgetAll: useMutation({ mutationFn: () => http.del("/two-factor/addresses"), onSuccess: refresh }),
    refresh,
  };
}

export function useOrganizationTwoFactor(enabled: boolean) {
  return useQuery({
    queryKey: [...ROOT, "organization"],
    queryFn: ({ signal }) => http.get<OrganizationTwoFactor>("/organization/two-factor", { signal }),
    enabled,
  });
}

export function useOrganizationTwoFactorChanges() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ROOT });
  return {
    require: useMutation({
      mutationFn: (required: boolean) => http.put<{ required: boolean }>("/organization/two-factor", { required }),
      onSuccess: refresh,
    }),
    resetMember: useMutation({
      mutationFn: (membershipId: string) => http.post<void>(`/organization/two-factor/members/${encodeURIComponent(membershipId)}/reset`, {}),
      onSuccess: refresh,
    }),
  };
}

export function usePlatformTwoFactorReset() {
  return useMutation({ mutationFn: (email: string) => http.post<void>("/platform/two-factor/reset", { email }) });
}
