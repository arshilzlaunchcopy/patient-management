import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatient } from "@/lib/patients/queries";
import { updatePatient } from "@/lib/patients/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { PatientForm } from "@/components/patients/patient-form";

export const metadata: Metadata = { title: "Edit patient" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const patient = await getPatient(id);
  if (!patient) notFound();

  const action = updatePatient.bind(null, patient.id);

  return (
    <>
      <p className="mb-4 text-sm">
        <Link
          href={`/patients/${patient.id}`}
          className="text-neutral-600 hover:underline"
        >
          ← {patient.name}
        </Link>
      </p>
      <PageHeader
        title="Edit profile"
        description={patient.serial_no ?? undefined}
      />
      <PatientForm
        action={action}
        initial={patient}
        submitLabel="Save changes"
        cancelHref={`/patients/${patient.id}`}
      />
    </>
  );
}
