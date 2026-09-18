import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatient, getVisits } from "@/lib/patients/queries";
import { listSmsForPatient, PATIENT_SMS_LIMIT } from "@/lib/sms/queries";
import { listPaymentsForPatient } from "@/lib/bookings/queries";
import { smsGatewayConfigured } from "@/lib/sms/provider";
import { isCustomTemplate, listTemplates } from "@/lib/messages/queries";
import { displayBD, waLink } from "@/lib/phone";
import { formatDate, todayDhaka } from "@/lib/dates";
import { sendFollowupLinkAction } from "@/lib/followup/actions";
import { ageSexLabel, sexLabel } from "@/components/patients/labels";
import { VisitHistory } from "@/components/patients/visit-history";
import { TrendChartsLazy } from "@/components/patients/trend-charts-lazy";
import { SmsPanel } from "@/components/patients/sms-panel";
import { SmsThread } from "@/components/patients/sms-thread";
import { PaymentsList, verifiedTotal } from "@/components/patients/payments-list";
import { CheckDelivery } from "@/components/outbox/check-delivery";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
} from "@/components/ui/styles";
import { SubmitButton } from "@/components/ui/submit-button";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABS = ["visits", "payments", "messages"] as const;
type Tab = (typeof TABS)[number];

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

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
  searchParams: Promise<{ followup?: string; tab?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();
  const { followup } = sp;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "visits";

  const [patient, visits, messages, allTemplates, payments] = await Promise.all([
    getPatient(id),
    getVisits(id),
    listSmsForPatient(id),
    listTemplates(),
    listPaymentsForPatient(id),
  ]);
  if (!patient) notFound();

  const configured = smsGatewayConfigured();
  const quickTexts = allTemplates
    .filter((t) => t.is_active && isCustomTemplate(t.key))
    .map((t) => ({ id: t.id, name: t.label_en, body: t.body_bn }));

  const whatsapp = waLink(patient.phone);
  const ageSex = ageSexLabel(patient);
  const nextVisit = visits[0]?.next_visit_date ?? null;
  const followupOverdue = !!nextVisit && nextVisit < todayDhaka();
  const awaitingReport = messages.some((m) => m.status === "sent" && m.delivery_status !== "delivered");
  const paid = verifiedTotal(payments);

  const tabHref = (t: Tab) => (t === "visits" ? `/patients/${patient.id}` : `/patients/${patient.id}?tab=${t}`);
  const tabs: { key: Tab; label: string; count: string | null }[] = [
    { key: "visits", label: "Visits", count: visits.length ? String(visits.length) : null },
    { key: "payments", label: "Payments", count: paid ? taka(paid) : payments.length ? String(payments.length) : null },
    {
      key: "messages",
      label: "SMS",
      count: messages.length ? (messages.length === PATIENT_SMS_LIMIT ? `${PATIENT_SMS_LIMIT}+` : String(messages.length)) : null,
    },
  ];

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
          <Link href={tabHref("messages")} className="font-medium underline">
            See it under SMS
          </Link>
          .
        </div>
      ) : followup === "none" ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-base text-amber-800">
          This patient has no follow-up date recorded, so there is nothing to send a link for.
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
              href={`/patients/${patient.id}/edit`}
              className={buttonSecondaryClass}
            >
              Edit profile
            </Link>
            {nextVisit ? (
              <form action={sendFollowupLinkAction}>
                <input type="hidden" name="patient_id" value={patient.id} />
                <SubmitButton
                  pendingText="Queuing…"
                  className={buttonSecondaryClass}
                  title={
                    followupOverdue
                      ? `Follow-up on ${formatDate(nextVisit)} has passed; sends a link to pick a new day`
                      : `Queues the reminder SMS for ${formatDate(nextVisit)}`
                  }
                >
                  {followupOverdue ? "Send rebooking link" : "Send follow-up link"}
                </SubmitButton>
              </form>
            ) : null}

            {/* Record tabs: the part of the page below Profile shows one of these at a time. */}
            <nav
              aria-label="Patient record"
              className="inline-flex max-w-full overflow-x-auto rounded-md border border-neutral-300 bg-neutral-100 p-1"
            >
              {tabs.map((t) => {
                const active = t.key === tab;
                return (
                  <Link
                    key={t.key}
                    href={tabHref(t.key)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-3 text-base transition-colors",
                      active
                        ? "bg-white font-medium text-accent-strong shadow-sm"
                        : "text-neutral-700 hover:text-neutral-900",
                    ].join(" ")}
                  >
                    {t.label}
                    {t.count ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                          active ? "bg-accent text-white" : "bg-neutral-200 text-neutral-700"
                        }`}
                      >
                        {t.count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <section className="mb-8">
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

      {tab !== "visits" ? (
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">
          {tab === "payments" ? "Online payments" : "SMS"}
        </h2>
      ) : null}

      {tab === "visits" ? (
        <>
          <TrendChartsLazy visits={visits} />
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">Visits</h2>
          <VisitHistory visits={visits} />
        </>
      ) : tab === "payments" ? (
        <>
          {payments.length > 0 ? (
            <p className="mb-3 text-sm text-neutral-600">
              bKash payments made through the booking link. {taka(paid)} verified in total; chamber
              fees are on each visit.
            </p>
          ) : null}
          <PaymentsList rows={payments} />
        </>
      ) : (
        <section id="messages">
          <div className={`${cardClass} mb-4 p-5`}>
            <SmsPanel
              patientId={patient.id}
              phoneLabel={displayBD(patient.phone)}
              templates={quickTexts}
              configured={configured}
            />
          </div>
          {configured && awaitingReport ? (
            <div className="mb-3">
              <CheckDelivery patientId={patient.id} compact />
            </div>
          ) : null}
          <SmsThread rows={messages} />
        </section>
      )}
    </>
  );
}
