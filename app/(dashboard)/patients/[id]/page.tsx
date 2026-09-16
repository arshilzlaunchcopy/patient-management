import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatient, getVisits } from "@/lib/patients/queries";
import { displayBD, waLink } from "@/lib/phone";
import { formatDate, todayDhaka } from "@/lib/dates";
import { sendFollowupLinkAction } from "@/lib/followup/actions";
import { ageSexLabel, sexLabel } from "@/components/patients/labels";
import { VisitHistory } from "@/components/patients/visit-history";
import { TrendChartsLazy } from "@/components/patients/trend-charts-lazy";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
} from "@/components/ui/styles";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const patient = UUID_RE.test(id) ? await getPatient(id) : null;
  return { title: patient?.name ?? "Patient" };
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-line text-base text-neutral-800">
        {value || <span className="text-neutral-400">—</span>}
      </dd>
    </div>
  );
}

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ followup?: string }>;
}) {
  const [{ id }, { followup }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();

  const [patient, visits] = await Promise.all([getPatient(id), getVisits(id)]);
  if (!patient) notFound();

  const whatsapp = waLink(patient.phone);
  const ageSex = ageSexLabel(patient);
  const nextVisit = visits[0]?.next_visit_date ?? null;
  const hasUpcomingFollowup = !!nextVisit && nextVisit >= todayDhaka();

  return (
    <>
      <p className="mb-4 text-sm">
        <Link href="/patients" className="text-neutral-600 hover:underline">
          ← All patients
        </Link>
      </p>

      {followup === "sent" ? (
        <div className="mb-4 rounded-md border border-accent bg-accent-soft p-4 text-base text-accent-strong">
          Follow-up reminder queued.{" "}
          <Link href="/outbox" className="font-medium underline">
            Open the Outbox
          </Link>{" "}
          to see the message and use its link.
        </div>
      ) : followup === "none" ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-base text-amber-800">
          This patient has no upcoming follow-up date.
        </div>
      ) : null}

      <header className={`${cardClass} mb-8 p-6 md:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-neutral-900">
                {patient.name}
              </h1>
              {patient.serial_no ? (
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-sm font-medium text-neutral-700">
                  {patient.serial_no}
                </span>
              ) : null}
              {patient.status !== "active" ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800">
                  {patient.status}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-base text-neutral-600">
              {[ageSex, patient.diabetes_type].filter(Boolean).join(" · ") ||
                "No age or diabetes type recorded"}
            </p>
            <p className="mt-3 text-lg tabular-nums text-neutral-900">
              {displayBD(patient.phone)}
              {patient.alt_phone ? (
                <span className="ml-3 text-base text-neutral-500">
                  alt {displayBD(patient.alt_phone)}
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/patients/${patient.id}/visit/new`}
              className={buttonPrimaryClass}
            >
              New visit
            </Link>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonSecondaryClass}
              >
                WhatsApp
              </a>
            ) : null}
            <Link
              href={`/messages?segment=patient&patient=${patient.id}`}
              className={buttonSecondaryClass}
            >
              Send SMS
            </Link>
            <Link
              href={`/patients/${patient.id}/edit`}
              className={buttonSecondaryClass}
            >
              Edit profile
            </Link>
            {hasUpcomingFollowup ? (
              <form action={sendFollowupLinkAction}>
                <input type="hidden" name="patient_id" value={patient.id} />
                <button
                  type="submit"
                  className={buttonSecondaryClass}
                  title={`Queues the reminder SMS for ${formatDate(nextVisit)}`}
                >
                  Send follow-up link
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Profile</h2>
        <dl className={`${cardClass} grid gap-x-8 gap-y-5 p-6 md:grid-cols-2 md:p-8`}>
          <Row label="Sex" value={sexLabel(patient.sex)} />
          <Row label="Date of birth" value={formatDate(patient.date_of_birth)} />
          <Row label="Diagnosed on" value={formatDate(patient.diagnosed_on)} />
          <Row
            label="Registered"
            value={`${formatDate(patient.created_at.slice(0, 10))} · ${
              patient.source === "walk_in" ? "at the chamber" : "online"
            }`}
          />
          <div className="md:col-span-2">
            <Row label="Address" value={patient.address} />
          </div>
          <Row label="Comorbidities" value={patient.comorbidities} />
          <Row label="Allergies" value={patient.allergies} />
          <div className="md:col-span-2">
            <Row label="Notes" value={patient.notes} />
          </div>
        </dl>
      </section>

      <TrendChartsLazy visits={visits} />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">
          Visits
          {visits.length > 0 ? (
            <span className="ml-2 text-base font-normal text-neutral-500">
              {visits.length}
            </span>
          ) : null}
        </h2>
        <VisitHistory visits={visits} />
      </section>
    </>
  );
}
