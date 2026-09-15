import type { AppointmentStatus } from "@/lib/types";

const STYLES: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Verified", className: "bg-accent-soft text-accent-strong" },
  pending_review: { label: "Awaiting review", className: "bg-amber-100 text-amber-800" },
  hold: { label: "Hold", className: "bg-neutral-100 text-neutral-700" },
  hold_expired: { label: "Hold expired", className: "bg-neutral-100 text-neutral-500" },
  completed: { label: "Seen", className: "bg-neutral-100 text-neutral-600" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-700" },
  no_show: { label: "No show", className: "bg-red-50 text-red-700" },
  expired: { label: "Expired", className: "bg-neutral-100 text-neutral-500" },
};

/** Badge describing where a booking stands, payment included. */
export function StatusBadge({
  status,
  holdExpiresAt,
}: {
  status: AppointmentStatus;
  holdExpiresAt?: string | null;
}) {
  let key: string = status;
  if (
    status === "hold" &&
    holdExpiresAt &&
    new Date(holdExpiresAt).getTime() < Date.now()
  ) {
    key = "hold_expired";
  }
  const s = STYLES[key] ?? STYLES.hold;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}

/** Statuses that still hold a place on the day. */
export const LIVE_STATUSES: AppointmentStatus[] = [
  "hold",
  "pending_review",
  "scheduled",
];
