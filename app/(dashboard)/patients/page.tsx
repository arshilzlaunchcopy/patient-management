import type { Metadata } from "next";
import Link from "next/link";
import { listPatients } from "@/lib/patients/queries";
import { PatientSearch } from "@/components/patients/patient-search";
import { PatientTable } from "@/components/patients/patient-table";
import { buttonPrimaryClass, cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const rows = await listPatients(q);
  const searching = q.trim().length > 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-neutral-900">Patients</h1>
        <Link href="/patients/new" className={buttonPrimaryClass}>
          Add patient
        </Link>
      </header>

      <div className="mb-6">
        <PatientSearch initialQuery={q} />
      </div>

      {rows.length > 0 ? (
        <>
          <PatientTable rows={rows} />
          <p className="mt-3 text-sm text-neutral-500">
            {rows.length === 200
              ? "Showing the first 200 matches. Refine the search to narrow it down."
              : `${rows.length} ${rows.length === 1 ? "patient" : "patients"}`}
          </p>
        </>
      ) : searching ? (
        <div className={`${cardClass} p-10 text-center`}>
          <p className="text-base text-neutral-700">
            No patients match “{q.trim()}”.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Try a different spelling, or search by phone number or serial.
          </p>
        </div>
      ) : (
        <div className={`${cardClass} p-10 text-center`}>
          <p className="text-base text-neutral-700">No patients yet.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Register the first patient to get started.
          </p>
          <Link
            href="/patients/new"
            className={`${buttonPrimaryClass} mt-6`}
          >
            Add patient
          </Link>
        </div>
      )}
    </>
  );
}
