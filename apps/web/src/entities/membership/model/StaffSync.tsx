import { useEffect } from "react";
import { loadStaff, resetStaff } from "./staff.js";

export function StaffSync() {
  useEffect(() => {
    void loadStaff();
    return resetStaff;
  }, []);

  return null;
}
