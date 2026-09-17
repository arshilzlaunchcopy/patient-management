import Link from "next/link";
import type { MergeCandidate, PendingPatient } from "@/lib/bookings/queries";
import { acceptPatient } from "@/lib/bookings/actions";
import { displayBD } from "@/lib/phone";
import { formatDate, formatDateTime } from "@/lib/dates";
import { StatusBadge } from "@/components/schedule/status";
import { buttonPrimaryClass, buttonSecondaryClass, cardClass } from "@/components/ui/styles";
import { SubmitButton } from "@/components/ui/submit-button";
import { MergePicker } from "./merge-picker";

export function PendingCard({
  patient,
  merging,
  mergeQuery,
  candidates,
}: {
  patient: PendingPatient;
  merging: boolean;
  mergeQuery: string;
  candidates: MergeCandidate[];
}) {
  const upcoming = patient.appointments
    .filter((a) => a.status !== "expired" && a.status !== "cancelled")
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  return (
    <li className={`${cardClass} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xl font-semibold text-neutral-900">{patient.name}</p>
          <p className="mt-1 text-base tabular-nums text-neutral-900">{displayBD(patient.phone)}</p>
          <p className="text-xs text-neutral-500">registered online {formatDateTime(patient.created_at)}</p>
        </div>
        <div className="text-right text-sm text-neutral-600">
          {upcoming.length === 0 ? (
            <span>No booking</span>
          ) : (
            upcoming.map((a) => (
              <p key={a.id} className="flex items-center justify-end gap-2">
                <span>
                  {formatDate(a.scheduled_date)}
                  {a.queue_no !== null ? ` · serial ${a.queue_no}` : ""}
                </span>
                <StatusBadge status={a.status} />
              </p>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action={acceptPatient}>
          <input type="hidden" name="patient_id" value={patient.id} />
          <SubmitButton pendingText="Accepting…" className={buttonPrimaryClass}>
            Accept as new patient
          </SubmitButton>
        </form>
        {!merging ? (
          <Link href={`/bookings?tab=new&merge=${patient.id}`} className={buttonSecondaryClass}>
            Merge into existing
          </Link>
        ) : null}
        <Link href={`/patients/${patient.id}`} className="text-sm text-neutral-600 hover:underline">
          Open record
        </Link>
      </div>

      {merging ? (
        <MergePicker tab="new" sourceId={patient.id} q={mergeQuery} candidates={candidates} />
      ) : null}
    </li>
  );
}
