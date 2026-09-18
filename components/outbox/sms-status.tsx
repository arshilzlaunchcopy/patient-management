import { DELIVERY_LABEL, type DeliveryStatus } from "@/lib/sms/delivery";

/**
 * One badge that tells the whole story of a message: whether it left the
 * system (queued / sent / failed) and, once the gateway has reported back,
 * whether the phone actually received it.
 */
export function SmsStatusBadge({
  status,
  deliveryStatus,
  deliveryDetail,
}: {
  status: "queued" | "sent" | "failed";
  deliveryStatus: DeliveryStatus | null;
  deliveryDetail?: string | null;
}) {
  let label: string;
  let className: string;
  if (status === "queued") {
    label = "Queued";
    className = "bg-amber-100 text-amber-800";
  } else if (status === "failed") {
    label = "Failed";
    className = "bg-red-50 text-red-700";
  } else if (deliveryStatus === "delivered") {
    label = DELIVERY_LABEL.delivered;
    className = "bg-accent text-white";
  } else if (deliveryStatus === "failed") {
    label = DELIVERY_LABEL.failed;
    className = "bg-red-50 text-red-700";
  } else {
    label = deliveryStatus === "pending" ? DELIVERY_LABEL.pending : "Sent";
    className = "bg-accent-soft text-accent-strong";
  }
  return (
    <span
      title={deliveryDetail ? `Gateway says: ${deliveryDetail}` : undefined}
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
