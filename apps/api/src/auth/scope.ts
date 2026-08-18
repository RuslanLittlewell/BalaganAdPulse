/**
 * Ownership reaches every model through foreign keys from Client, so a filter
 * is only needed on the query that first fetches an entity by an id from
 * outside. These are the only place the chain is spelled out.
 */
export const ownedClient = (ownerId: string, id: string) => ({ id, ownerId });

export const ownedCampaign = (ownerId: string, id: string) =>
  ({ id, client: { ownerId } });

export const ownedProperty = (ownerId: string, id: string) =>
  ({ id, campaign: { client: { ownerId } } });

export const ownedRecord = (ownerId: string, id: string) =>
  ({ id, campaign: { client: { ownerId } } });
