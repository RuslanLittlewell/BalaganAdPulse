import { createContext, useContext, type ReactNode } from "react";
import { X } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import { t } from "@/shared/config/index.js";

export type AlertTone = "error" | "success";

export interface AlertsValue {
  raise: (message: string, tone?: AlertTone) => void;
}

const AlertsContext = createContext<AlertsValue | null>(null);

const DISMISS_AFTER_MS = 8_000;

export function useAlerts(): AlertsValue {
  const value = useContext(AlertsContext);
  if (!value) throw new Error("useAlerts needs an AlertsProvider above it");
  return value;
}

const alerts: AlertsValue = {
  raise: (message, tone = "error") => { toast(message, { type: tone }); },
};

export function AlertsProvider({ children }: { children: ReactNode }) {
  return (
    <AlertsContext.Provider value={alerts}>
      {children}
      <ToastContainer
        aria-label={t("alert.region")}
        position="top-right"
        theme="colored"
        autoClose={DISMISS_AFTER_MS}
        closeButton={({ closeToast }) => (
          <button
            type="button"
            aria-label={t("alert.dismiss")}
            className="shrink-0 self-start rounded-sm opacity-80 transition-opacity hover:opacity-100 ml-auto"
            onClick={closeToast}
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      />
    </AlertsContext.Provider>
  );
}
