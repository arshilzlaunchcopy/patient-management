import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatient, getVisits } from "@/lib/patients/queries";
import { getAppointment } from "@/lib/appointments/queries";
import { getSettings, settingInt } from "@/lib/settings";
import { createVisit } from "@/lib/visits/actions";
import { formatDate, todayDhaka } from "@/lib/dates";
import { displayBD } from "@/lib/phone";
import { ageSexLabel } from "@/components/patients/labels";
import { VisitForm } from "@/components/visits/visit-form";
import { cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "New visit" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OPEN_STATUSES = ["scheduled", "pending_review", "hold"];

export default async function NewVisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ appointment?: string }>;
}) {
  const [{ id }, { appointment: appointmentParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!UUID_RE.test(id)) notFound();

  const [patient, visits, settings, appointment] = await Promise.all([
    getPatient(id),
    getVisits(id),
    getSettings(["in_person_fee", "video_fee"] as const),
    appointmentParam && UUID_RE.test(appointmentParam)
      ? getAppointment(appointmentParam)
      : Promise.resolve(null),
  ]);
  if (!patient) notFound();

  // Only link an appointment that belongs to this patient and is still open.
  const linked =
    appointment &&
    appointment.patient_id === patient.id &&
    OPEN_STATUSES.includes(appointment.status)
      ? appointment
      : null;

  // Online bookings are paid through bKash before the call, so the visit
  // starts with that method and amount instead of the cash default.
  const paidOnline = !!linked && linked.booking_source !== "doctor";

  const previous = visits[0] ?? null;
  const action = createVisit.bind(null, patient.id, linked?.id ?? null);

  const fees = {
    in_person: settingInt(settings.in_person_fee, 500),
    video: settingInt(settings.video_fee, 500),
  };

  const ageSex = ageSexLabel(patient);

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

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">New visit</h1>
        <p className="mt-1 text-base text-neutral-600">
          {patient.name}
          {patient.serial_no ? ` · ${patient.serial_no}` : ""}
          {ageSex ? ` · ${ageSex}` : ""}
          {patient.diabetes_type ? ` · ${patient.diabetes_type}` : ""}
          {" · "}
          <span className="tabular-nums">{displayBD(patient.phone)}</span>
        </p>
        {linked ? (
          <p className="mt-2 text-sm text-neutral-600">
            Closes the {linked.mode === "video" ? "video" : "chamber"}{" "}
            appointment for {formatDate(linked.scheduled_date)}
            {linked.queue_no ? `, serial ${linked.queue_no}` : ""}.
          </p>
        ) : null}
      </header>

      {previous ? (
        <aside className={`${cardClass} mb-6 p-5`}>
          <p className="text-sm font-medium text-neutral-700">
            Previous visit · {formatDate(previous.visit_date)}
          </p>
          <p className="mt-1 text-base tabular-nums text-neutral-800">
            {[
              previous.hba1c !== null ? `HbA1c ${Number(previous.hba1c).toFixed(1)}%` : null,
              previous.fbs !== null ? `FBS ${Number(previous.fbs).toFixed(1)}` : null,
              previous.weight_kg !== null ? `${Number(previous.weight_kg).toFixed(1)} kg` : null,
              previous.bp_systolic !== null && previous.bp_diastolic !== null
                ? `BP ${previous.bp_systolic}/${previous.bp_diastolic}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No measurements recorded"}
          </p>
          {previous.prescription ? (
            <p className="mt-2 whitespace-pre-line text-base text-neutral-800">
              <span className="text-sm font-medium text-neutral-500">Rx </span>
              {previous.prescription}
            </p>
          ) : null}
        </aside>
      ) : (
        <p className="mb-6 text-sm text-neutral-500">
          First visit for this patient.
        </p>
      )}

      <VisitForm
        action={action}
        patientId={patient.id}
        defaultDate={linked?.scheduled_date ?? todayDhaka()}
        defaultMode={linked?.mode ?? "in_person"}
        defaultPaymentMethod={paidOnline ? "bkash" : "cash"}
        defaultFee={paidOnline ? linked.fee_amount : null}
        paymentNote={paidOnline ? "Booked and paid online through bKash." : undefined}
        fees={fees}
        cancelHref={`/patients/${patient.id}`}
      />
    </>
  );
}
