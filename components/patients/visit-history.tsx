import { formatDate, isPastDate } from "@/lib/dates";
import type { Visit } from "@/lib/types";
import { cardClass } from "@/components/ui/styles";

function num(v: number | null, unit = "", digits = 1): string {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toFixed(digits)}${unit}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[5.5rem]">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-base tabular-nums text-neutral-900">
        {value}
      </dd>
    </div>
  );
}

function Note({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-line text-base text-neutral-800">
        {value}
      </dd>
    </div>
  );
}

const MODE_LABEL: Record<string, string> = {
  in_person: "Chamber",
  video: "Video",
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "cash",
  bkash: "bKash",
  free: "free",
};

/**
 * Newest first. Each visit is a native <details> element: the summary row
 * shows the numbers the doctor scans for, the body shows the notes.
 * No JavaScript needed.
 */
export function VisitHistory({ visits }: { visits: Visit[] }) {
  if (visits.length === 0) {
    return (
      <div className={`${cardClass} p-8 text-center`}>
        <p className="text-base text-neutral-600">No visits recorded yet.</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {visits.map((v, i) => {
        const bp =
          v.bp_systolic !== null && v.bp_diastolic !== null
            ? `${v.bp_systolic}/${v.bp_diastolic}`
            : "—";
        const nextOverdue = isPastDate(v.next_visit_date) && i === 0;
        const fee =
          v.fee_charged !== null
            ? `৳${Number(v.fee_charged).toFixed(0)}${
                v.payment_method ? ` (${PAYMENT_LABEL[v.payment_method]})` : ""
              }`
            : null;

        return (
          <li key={v.id}>
            <details className={`${cardClass} group`} open={i === 0}>
              <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-base font-semibold text-neutral-900">
                    {formatDate(v.visit_date)}
                    <span className="ml-2 text-sm font-normal text-neutral-500">
                      {MODE_LABEL[v.mode] ?? v.mode}
                    </span>
                  </span>
                  <span className="text-sm text-neutral-500 group-open:hidden">
                    Show details
                  </span>
                  <span className="hidden text-sm text-neutral-500 group-open:inline">
                    Hide details
                  </span>
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                  <Stat label="HbA1c" value={num(v.hba1c, "%")} />
                  <Stat label="FBS" value={num(v.fbs)} />
                  <Stat label="Weight" value={num(v.weight_kg, " kg")} />
                  <Stat label="BP" value={bp} />
                  <Stat
                    label="Next visit"
                    value={formatDate(v.next_visit_date) || "—"}
                  />
                </dl>
                {nextOverdue ? (
                  <p className="mt-2 text-sm font-medium text-red-700">
                    Follow-up date has passed.
                  </p>
                ) : null}
              </summary>

              <div className="border-t border-neutral-200 px-5 py-4">
                <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                  <div className="flex flex-wrap gap-x-8 gap-y-3 md:col-span-2">
                    <Stat label="RBS" value={num(v.rbs)} />
                    <Stat label="Creatinine" value={num(v.creatinine, "", 2)} />
                    <Stat label="Height" value={num(v.height_cm, " cm", 0)} />
                    <Stat label="Fee" value={fee ?? "—"} />
                  </div>
                  <Note label="Complaints" value={v.complaints} />
                  <Note label="Examination" value={v.examination} />
                  <Note label="Diagnosis" value={v.diagnosis} />
                  <Note label="Prescription" value={v.prescription} />
                  <Note label="Advice" value={v.advice} />
                </dl>
                {!v.complaints &&
                !v.examination &&
                !v.diagnosis &&
                !v.prescription &&
                !v.advice ? (
                  <p className="text-sm text-neutral-500">No notes for this visit.</p>
                ) : null}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
