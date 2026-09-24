import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck } from "lucide-react";
import { t } from "@/shared/config/index.js";
import SwipeToast from "../SwipeToast/SwipeToast.js";

export type AlertTone = "error" | "success";

export interface AlertsValue {
  raise: (message: string, tone?: AlertTone) => void;
}

interface RaisedAlert {
  id: number;
  message: string;
  tone: AlertTone;
}

const AlertsContext = createContext<AlertsValue | null>(null);

const DISMISS_AFTER_MS = 8_000;

const TONES: Record<AlertTone, { role: "alert" | "status"; fuse: string; icon: ReactNode }> = {
  error: { role: "alert", fuse: "#f87171", icon: <CircleAlert className="text-red-400" /> },
  success: { role: "status", fuse: "#4ade80", icon: <CircleCheck className="text-green-400" /> },
};

export function useAlerts(): AlertsValue {
  const value = useContext(AlertsContext);
  if (!value) throw new Error("useAlerts needs an AlertsProvider above it");
  return value;
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<RaisedAlert[]>([]);
  const nextId = useRef(0);

  const raise = useCallback((message: string, tone: AlertTone = "error") => {
    nextId.current += 1;
    const id = nextId.current;
    setAlerts((current) => [...current, { id, message, tone }]);
  }, []);

  const value = useMemo(() => ({ raise }), [raise]);

  return (
    <AlertsContext.Provider value={value}>
      {children}
      {alerts.length > 0 ? createPortal(
        <section
          aria-label={t("alert.region")}
          className="pointer-events-none fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom,0px))] z-1000 flex w-[min(356px,calc(100vw-32px))] flex-col sm:right-8 sm:bottom-[calc(32px+env(safe-area-inset-bottom,0px))]"
        >
          {alerts.map((alert) => (
            <div key={alert.id} role={TONES[alert.tone].role} data-tone={alert.tone} className="pointer-events-auto">
              <SwipeToast
                inline
                title={alert.message}
                icon={TONES[alert.tone].icon}
                fuseColor={TONES[alert.tone].fuse}
                duration={DISMISS_AFTER_MS}
                closeButton
                closeLabel={t("alert.dismiss")}
                onClose={() => setAlerts((current) => current.filter((held) => held.id !== alert.id))}
              />
            </div>
          ))}
        </section>,
        document.body,
      ) : null}
    </AlertsContext.Provider>
  );
}
