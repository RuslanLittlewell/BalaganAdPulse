import { useEffect } from "react";
import { loadCampaignNames, resetCampaignNames } from "./campaignNames.js";

export function CampaignNamesSync() {
  useEffect(() => {
    void loadCampaignNames();
    return resetCampaignNames;
  }, []);

  return null;
}
