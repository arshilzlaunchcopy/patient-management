import type { Metadata } from "next";
import Link from "next/link";
import {
  LIST_LIMIT,
  listPatients,
  parsePatientFilter,
  parsePeriod,
  type PatientFilter,
  type PeriodRange,
} from "@/lib/patients/queries";
import { formatDate, todayDhaka } from "@/lib/dates";
import { PatientSearch } from "@/components/patients/patient-search";
import { PatientTable } from "@/components/patients/patient-table";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/ui/styles";

export const metadata: Metadata = { title: "Patients" };

const FILTERS: { key: PatientFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Follow-up overdue" },
  { key: "due_soon", label: "Due in 7 days" },
  { key: "not_seen", label: "Not seen 6+ months" },
  { key: "period", label: "Custom period…" },
];

const EMPTY: Record<PatientFilter, string> = {
  all: "No patients yet.",
  overdue: "Nobody is overdue. Every active patient with a follow-up date is on time.",
  due_soon: "No follow-ups fall in the next 7 days.",
  not_seen: "Everyone with a recorded visit has been seen in the last 6 months.",
  period: "No follow-up dates fall in this period.",
};

function href(filter: PatientFilter, q: string, period?: PeriodRange) {
  const p = new URLSearchParams();
  if (filter !== "all") p.set("filter", filter);
  if (filter === "period" && period) {
    p.set("from", period.from);
    p.set("to", period.to);
  }
  if (q) p.set("q", q);
  const qs = p.toString();
  return qs ? `/patients?${qs}` : "/patients";
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const filter = parsePatientFilter(sp.filter);
  const period = filter === "period" ? parsePeriod(sp) : undefined;
  const rows = await listPatients(q, filter, period);
  const searching = q.length > 0;
  const today = todayDhaka();
  const listQs = href(filter, q, period).split("?")[1];
  const exportHref = listQs ? `/patients/export?${listQs}` : "/patients/export";

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Patients</h1>
        <div className="flex flex-wrap gap-3">
          <a
            href={exportHref}
            className={buttonSecondaryClass}
            title="Downloads a spreadsheet Excel opens directly"
          >
            Export to Excel
          </a>
          <Link href="/patients/new" className={buttonPrimaryClass}>
            Add patient
          </Link>
        </div>
      </header>

      <div className="mb-4">
        <PatientSearch initialQuery={q} />
      </div>

      <nav aria-label="Filter patients" className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={href(f.key, q, f.key === "period" ? period : undefined)}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
              ].join(" ")}
            >
              {f.label}
            </Link>
          );
        })}
        {filter !== "all" && filter !== "period" && rows.length > 0 && !searching ? (
          <Link
            href={`/messages?segment=${filter}`}
            className={`${buttonSecondaryClass} ml-auto px-3 py-1.5 text-sm`}
          >
            Message these {rows.length} patients
          </Link>
        ) : null}
      </nav>

      {filter === "period" && period ? (
        <form
          method="get"
          action="/patients"
          className={`${cardClass} mb-6 flex flex-wrap items-end gap-3 p-4`}
        >
          <input type="hidden" name="filter" value="period" />
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <div>
            <label htmlFor="period-from" className={labelClass}>
              Follow-up date from
            </label>
            <input
              id="period-from"
              name="from"
              type="date"
              defaultValue={period.from}
              max={today}
              className={`${inputClass} w-44`}
            />
          </div>
          <div>
            <label htmlFor="period-to" className={labelClass}>
              to
            </label>
            <input
              id="period-to"
              name="to"
              type="date"
              defaultValue={period.to}
              className={`${inputClass} w-44`}
            />
          </div>
          <button type="submit" className={buttonSecondaryClass}>
            Show
          </button>
          <p className="basis-full text-sm text-neutral-500 sm:basis-auto sm:self-center">
            Patients whose latest follow-up date falls in this window, earliest first. Dates before
            today are missed follow-ups; dates after today are coming up.
          </p>
        </form>
      ) : null}

      {rows.length > 0 ? (
        <>
          <PatientTable rows={rows} />
          <p className="mt-3 text-sm text-neutral-500">
            {rows.length === LIST_LIMIT
              ? `Showing the first ${LIST_LIMIT} matches. Refine the search to narrow it down.`
              : `${rows.length} ${rows.length === 1 ? "patient" : "patients"}`}
            {filter === "period" && period
              ? ` with a follow-up between ${formatDate(period.from)} and ${formatDate(period.to)}`
              : ""}
          </p>
        </>
      ) : searching ? (
        <div className={`${cardClass} p-10 text-center`}>
          <p className="text-base text-neutral-700">
            No patients match “{q}”{filter !== "all" ? " in this filter" : ""}.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Try a different spelling, or search by phone number or serial.
          </p>
        </div>
      ) : (
        <div className={`${cardClass} p-10 text-center`}>
          <p className="text-base text-neutral-700">{EMPTY[filter]}</p>
          {filter === "all" ? (
            <>
              <p className="mt-2 text-sm text-neutral-500">
                Register the first patient to get started, or load the demo set from Settings.
              </p>
              <Link href="/patients/new" className={`${buttonPrimaryClass} mt-6`}>
                Add patient
              </Link>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
