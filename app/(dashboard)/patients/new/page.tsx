import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { PatientForm } from "@/components/patients/patient-form";
import { createPatient } from "@/lib/patients/actions";

export const metadata: Metadata = { title: "New patient" };

export default function NewPatientPage() {
  return (
    <>
      <PageHeader
        title="New patient"
        description="A serial number is assigned automatically when you save."
      />
      <PatientForm
        action={createPatient}
        submitLabel="Register patient"
        cancelHref="/patients"
      />
    </>
  );
}
