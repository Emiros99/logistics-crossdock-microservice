/** A BullMQ sor neve (Redis-backed). Egyetlen forrás producer és processor számára. */
export const NOTIFICATIONS_QUEUE = 'notifications';

/** A last-mile futár értesítő job neve. */
export const NOTIFY_LAST_MILE_COURIER = 'NOTIFY_LAST_MILE_COURIER';

/** A NOTIFY_LAST_MILE_COURIER job payloadja (típusszerződés producer <-> processor). */
export interface NotifyCourierPayload {
  trackingNumber: string;
  status: string;
  location: string;
}
