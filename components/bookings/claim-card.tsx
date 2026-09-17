import Link from "next/link";
import type { ClaimRow, MergeCandidate } from "@/lib/bookings/queries";
import { rejectClaim, verifyClaim } from "@/lib/bookings/actions";
import { displayBD, waLink } from "@/lib/phone";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  buttonDangerClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
} from "@/components/ui/styles";
import { SubmitButton } from "@/components/ui/submit-button";
import { MergePicker } from "./merge-picker";

export function ClaimCard({
  claim,
  merging,
  mergeQuery,
  candidates,
}: {
  claim: ClaimRow;
  merging: boolean;
  mergeQuery: string;
  candidates: MergeCandidate[];
}) {
  const { appointment: a } = claim;
  const p = a.patient;
  const nameDiffers = claim.claimed_name.trim().toLowerCase() !== p.name.trim().toLowerCase();
  const wa = waLink(p.phone);

  return (
    <li className={`${cardClass} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xl font-semibold text-neutral-900">{claim.claimed_name}</p>
          <p className="mt-0.5 text-sm text-neutral-600">
            {p.status === "pending" ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                New patient
              </span>
            ) : (
              <>
                Registered as{" "}
                <Link href={`/patients/${p.id}`} className="font-medium text-accent-strong hover:underline">
                  {p.name}
                </Link>
                {p.serial_no ? ` (${p.serial_no})` : ""}
                {nameDiffers ? <span className="ml-1 text-amber-700">name differs</span> : null}
              </>
            )}
          </p>
          <p className="mt-2 text-base">
            <span className="tabular-nums text-neutral-900">{displayBD(p.phone)}</span>
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 text-sm font-medium text-accent-strong hover:underline"
              >
                WhatsApp
              </a>
            ) : null}
          </p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-neutral-900">
            ৳{Number(claim.amount ?? a.fee_amount ?? 0).toFixed(0)}
          </p>
          <p className="text-sm text-neutral-600">
            {formatDate(a.scheduled_date)}
            {a.queue_no !== null ? ` · serial ${a.queue_no}` : ""}
          </p>
          <p className="text-xs text-neutral-500">submitted {formatDateTime(claim.created_at)}</p>
        </div>
      </div>

      {/* Proof, sized to be checked against the bKash app on a phone. */}
      <dl className="mt-4 grid gap-4 rounded-md bg-neutral-50 p-4 sm:grid-cols-2">
        {claim.trx_id ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">TrxID</dt>
            <dd className="mt-1 font-mono text-3xl font-semibold tracking-widest text-neutral-900">
              {claim.trx_id}
            </dd>
          </div>
        ) : null}
        {claim.sender_phone ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Sent from</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums text-neutral-900">
              {displayBD(claim.sender_phone)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action={verifyClaim}>
          <input type="hidden" name="claim_id" value={claim.id} />
          <SubmitButton pendingText="Verifying…" className={buttonPrimaryClass}>
            Verify
          </SubmitButton>
        </form>

        <details className="group">
          <summary className={`${buttonSecondaryClass} cursor-pointer list-none border-red-200 text-red-700 hover:bg-red-50 [&::-webkit-details-marker]:hidden`}>
            Reject
          </summary>
          <form action={rejectClaim} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="claim_id" value={claim.id} />
            <div className="min-w-[14rem] flex-1">
              <label htmlFor={`note-${claim.id}`} className="block text-sm font-medium text-neutral-800">
                Reason (optional, for your records)
              </label>
              <input id={`note-${claim.id}`} name="note" type="text" maxLength={200} className={inputClass} />
            </div>
            <SubmitButton pendingText="Rejecting…" className={buttonDangerClass}>
              Reject and ask again
            </SubmitButton>
          </form>
        </details>

        {p.status === "pending" && !merging ? (
          <Link href={`/bookings?tab=verify&merge=${p.id}`} className={buttonSecondaryClass}>
            Merge into existing
          </Link>
        ) : null}
      </div>

      {merging ? (
        <MergePicker tab="verify" sourceId={p.id} q={mergeQuery} candidates={candidates} />
      ) : null}
    </li>
  );
}
