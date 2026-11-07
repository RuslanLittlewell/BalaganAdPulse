import { usePatchLead, type Lead, type LeadInput } from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { useAlerts } from "@/shared/ui/index.js";

const reasonOf = (error: unknown) =>
  error instanceof ApiError && error.status < 500 ? error.message : t("crm.form.saveFailed");

export function useSaveLead(boardKey: string, lead: Lead) {
  const patch = usePatchLead(boardKey);
  const { raise } = useAlerts();
  return async (body: LeadInput): Promise<boolean> => {
    try {
      await patch.mutateAsync({ id: lead.id, body });
      return true;
    } catch (error) {
      raise(reasonOf(error));
      return false;
    }
  };
}
