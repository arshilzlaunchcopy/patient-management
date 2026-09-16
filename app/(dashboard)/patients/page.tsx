import type { Metadata } from "next";
import Link from "next/link";
import {
  LIST_LIMIT,
  listPatients,
  parsePatientFilter,
  type PatientFilter,
} from "@/lib/patients/queries";
import { PatientSearch } from "@/components/patients/patient-search";
import { PatientTable } from "@/components/patients/patient-table";
import { buttonPrimaryClass, buttonSecondaryClass, cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Patients" };

const FILTERS: { key: PatientFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Follow-up overdue" },
  { key: "due_soon", label: "Due in 7 days" },
  { key: "not_seen", label: "Not seen 6+ months" },
];

const EMPTY: Record<PatientFilter, string> = {
  all: "No patients yet.",
  overdue: "Nobody is overdue. Every active patient with a follow-up date is on time.",
  due_soon: "No follow-ups fall in the next 7 days.",
  not_seen: "Everyone with a recorded visit has been seen in the last 6 months.",
};

function href(filter: PatientFilter, q: string) {
  const p = new URLSearchParams();
  if (filter !== "all") p.set("filter", filter);
  if (q) p.set("q", q);
  const qs = p.toString();
  return qs ? `/patients?${qs}` : "/patients";
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const filter = parsePatientFilter(sp.filter);
  const rows = await listPatients(q, filter);
  const searching = q.length > 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Patients</h1>
        <Link href="/patients/new" className={buttonPrimaryClass}>
          Add patient
        </Link>
      </header>

      <div className="mb-4">
        <PatientSearch initialQuery={q} />
      </div>

      <nav aria-label="Filter patients" className="mb-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={href(f.key, q)}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-full border px-3.5 py-1.5 text-sm font-medium",
                active
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
              ].join(" ")}
            >
              {f.label}
            </Link>
          );
        })}
        {filter !== "all" && rows.length > 0 && !searching ? (
          <Link
            href={`/messages?segment=${filter}`}
            className={`${buttonSecondaryClass} ml-auto px-3 py-1.5 text-sm`}
          >
            Message these {rows.length} patients
          </Link>
        ) : null}
      </nav>

      {rows.length > 0 ? (
        <>
          <PatientTable rows={rows} />
          <p className="mt-3 text-sm text-neutral-500">
            {rows.length === LIST_LIMIT
              ? `Showing the first ${LIST_LIMIT} matches. Refine the search to narrow it down.`
              : `${rows.length} ${rows.length === 1 ? "patient" : "patients"}`}
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
