/**
 * Delivery status vocabulary shared by server code and components. No
 * server-only imports here so badges can render anywhere.
 */

export type DeliveryStatus = "pending" | "delivered" | "failed";

/**
 * Reduce the gateway's free-text recipient status to three states.
 * sms.net.bd says things like "Sent", "Delivered", "Failed", "Pending",
 * "Expired"; anything we do not recognise stays pending and is asked again.
 */
export function classifyDelivery(raw: string): DeliveryStatus {
  const s = raw.trim().toLowerCase();
  if (/undeliver|not deliver/.test(s)) return "failed";
  if (/deliver|success/.test(s)) return "delivered";
  if (/fail|reject|expire|block|invalid|dnd|error|unknown number|blacklist/.test(s)) return "failed";
  return "pending";
}

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  pending: "Sent, awaiting delivery",
  delivered: "Delivered",
  failed: "Not delivered",
};
