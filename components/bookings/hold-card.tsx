import Link from "next/link";
import type { HoldRow } from "@/lib/bookings/queries";
import { releaseHold } from "@/lib/bookings/actions";
import { displayBD } from "@/lib/phone";
import { formatDate } from "@/lib/dates";
import { Countdown } from "@/components/dashboard/countdown";
import { buttonSecondaryClass, cardClass } from "@/components/ui/styles";
import { SubmitButton } from "@/components/ui/submit-button";

const SOURCE: Record<string, string> = {
  open_link: "public link",
  followup_link: "follow-up link",
  doctor: "doctor",
};

export function HoldCard({ hold }: { hold: HoldRow }) {
  return (
    <li className={`${cardClass} flex flex-wrap items-center justify-between gap-4 p-5`}>
      <div>
        <p className="text-lg font-semibold text-neutral-900">
          <Link href={`/patients/${hold.patient.id}`} className="hover:underline">
            {hold.patient.name}
          </Link>
          {hold.patient.status === "pending" ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              new
            </span>
          ) : null}
        </p>
        <p className="text-sm text-neutral-600">
          <span className="tabular-nums">{displayBD(hold.patient.phone)}</span>
          {" · "}
          {formatDate(hold.scheduled_date)}
          {" · via "}
          {SOURCE[hold.booking_source] ?? hold.booking_source}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <p className="text-lg font-medium text-neutral-900">
          <Countdown until={hold.hold_expires_at} />
        </p>
        <form action={releaseHold}>
          <input type="hidden" name="appointment_id" value={hold.id} />
          <SubmitButton pendingText="Releasing…" className={buttonSecondaryClass}>
            Release
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
