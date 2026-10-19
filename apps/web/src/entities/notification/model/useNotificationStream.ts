import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { NotificationList } from "../api/api.js";
import { NOTIFICATIONS_KEY } from "../api/queries.js";
import { withArrived } from "./list.js";
import { openNotificationStream, type EventSourceFactory } from "./stream.js";

export function useNotificationStream(options: { createSource?: EventSourceFactory } = {}) {
  const qc = useQueryClient();
  const createSource = options.createSource;

  useEffect(() => {
    const stream = openNotificationStream({
      createSource,
      onNotification: (notification) => {
        if (qc.getQueryData<NotificationList>(NOTIFICATIONS_KEY)) {
          qc.setQueryData<NotificationList>(NOTIFICATIONS_KEY, (list) => list && withArrived(list, notification));
        } else {
          void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
        }
      },
      onReconnected: () => { void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }); },
    });
    return () => { stream.close(); };
  }, [qc, createSource]);
}
