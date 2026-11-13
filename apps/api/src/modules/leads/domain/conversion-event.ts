export const CONVERSION_EVENT_LIMIT = 10;
export const CONVERSION_EVENT_NAME_LIMIT = 50;

export interface ConversionEventFields {
  name: string;
  stages: string[];
  carriesAmount: boolean;
}

export interface ConversionEventRecord extends ConversionEventFields {
  id: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReachedEvent {
  orgId: string;
  projectId: string;
  leadId: string;
  eventId: string;
  eventName: string;
  carriesAmount: boolean;
  reachedAt: Date;
}

export function nameKeyOf(name: string): string {
  return name.toLocaleLowerCase('ru');
}
