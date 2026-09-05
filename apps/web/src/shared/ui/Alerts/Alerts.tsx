import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";

export type AlertTone = "error" | "success";

interface Alert {
  id: number;
  tone: AlertTone;
  message: string;
}

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

const TONE: Record<AlertTone, string> = {
  error: "border-destructive/40 bg-destructive text-destructive-foreground",
  success: "border-emerald-500/40 bg-emerald-600 text-white",
};

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const dismiss = useCallback((id: number) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }, []);

  const raise = useCallback((message: string, tone: AlertTone = "error") => {
    const id = Date.now() + Math.random();
    setAlerts((current) => [...current, { id, tone, message }]);
    setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
  }, [dismiss]);

  const value = useMemo(() => ({ raise }), [raise]);

  return (
    <AlertsContext.Provider value={value}>
      {children}
      <div
        data-testid="alerts"
        aria-live="assertive"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col items-center gap-2"
      >
        {alerts.map((alert) => (
          <div
            key={alert.id}
            role="alert"
            className={cn(
              "pointer-events-auto flex max-w-[min(560px,calc(100vw-2rem))] items-start gap-3",
              "rounded-lg border px-4 py-3 text-sm shadow-lg",
              TONE[alert.tone],
            )}
          >
            <span className="min-w-0 flex-1">{alert.message}</span>
            <button
              type="button"
              aria-label={t("alert.dismiss")}
              className="shrink-0 rounded-sm opacity-80 transition-opacity hover:opacity-100"
              onClick={() => dismiss(alert.id)}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </AlertsContext.Provider>
  );
}
