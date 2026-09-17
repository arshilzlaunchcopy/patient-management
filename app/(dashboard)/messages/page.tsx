import type { Metadata } from "next";
import Link from "next/link";
import { createUserClient } from "@/lib/supabase/server";
import {
  describeSegment,
  parseSegment,
  resolveRecipients,
  SEGMENT_KEYS,
  SEGMENTS,
  segmentQuery,
} from "@/lib/messages/segments";
import { isCustomTemplate, listCampaigns, listTemplates } from "@/lib/messages/queries";
import { getSettings, settingNumber } from "@/lib/settings";
import { formatDateTime } from "@/lib/dates";
import { formatDateLongBn } from "@/lib/i18n/format";
import { displayBD } from "@/lib/phone";
import { PageHeader } from "@/components/dashboard/page-header";
import { AudiencePicker } from "@/components/messages/audience-picker";
import { ComposeForm } from "@/components/messages/compose-form";
import { CustomAudience } from "@/components/messages/custom-audience";
import { cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Messages" };

const PREVIEW_ROWS = 40;

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    segment?: string;
    date?: string;
    type?: string;
    patient?: string;
    text?: string;
  }>;
}) {
  const sp = await searchParams;
  const filter = parseSegment(sp);
  const supabase = await createUserClient();

  const [recipients, settings, campaigns, allTemplates] = await Promise.all([
    resolveRecipients(supabase, filter),
    getSettings(["sms_price_per_segment", "whatsapp_number"] as const),
    listCampaigns(),
    listTemplates(),
  ]);
  // Every active text is offered: the doctor's own first, then the automatic
  // ones (whose placeholders are filled where the audience fixes them).
  const templates = allTemplates
    .filter((t) => t.is_active)
    .map((t) => ({
      id: t.id,
      name: t.label_en,
      body: t.body_bn,
      custom: isCustomTemplate(t.key),
      variables: t.variables,
    }));
  const fills: Record<string, string> = {};
  if (filter.date) fills.date = formatDateLongBn(filter.date);
  const contact = settings.whatsapp_number && !/X/i.test(settings.whatsapp_number)
    ? displayBD(settings.whatsapp_number)
    : "";
  if (contact) fills.contact = contact;

  const initialBody = (sp.text ?? "").slice(0, 1000);
  const price = settingNumber(settings.sms_price_per_segment, 0.3);
  const audienceLabel = describeSegment(
    filter,
    filter.segment === "patient" ? recipients[0]?.name : undefined,
  );

  // The picker never offers "one patient"; that audience comes from a patient's page.
  const options = SEGMENT_KEYS.filter((k) => k !== "patient" || filter.segment === "patient").map(
    (k) => ({ key: k, label: k === "patient" ? audienceLabel : SEGMENTS[k].label }),
  );

  const hidden: Record<string, string> = { segment: filter.segment };
  if (filter.date) hidden.date = filter.date;
  if (filter.type) hidden.type = filter.type;
  if (filter.patient) hidden.patient = filter.patient;

  const picker = (
    <AudiencePicker
      options={options}
      segment={filter.segment}
      date={filter.date ?? ""}
      type={filter.type ?? ""}
      help={SEGMENTS[filter.segment].help}
    />
  );

  return (
    <>
      <PageHeader
        title="Messages"
        description="Pick who should get it, write it in Bangla, check the cost, send. Every message lands in the Outbox."
      />

      {filter.segment === "custom" ? (
        <CustomAudience
          picker={picker}
          pricePerSegment={price}
          templates={templates}
          initialBody={initialBody}
          fills={fills}
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <section className={`${cardClass} p-5`} aria-labelledby="audience-heading">
          <h2 id="audience-heading" className="mb-4 text-base font-semibold text-neutral-900">
            Audience
          </h2>
          {picker}

          <h3 className="mt-6 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Recipients
            <span className="font-normal normal-case tracking-normal">{recipients.length}</span>
          </h3>
          {recipients.length === 0 ? (
            <p className="mt-2 text-base text-neutral-500">Nobody matches this audience yet.</p>
          ) : (
            <>
              <ul className="mt-2 divide-y divide-neutral-100">
                {recipients.slice(0, PREVIEW_ROWS).map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <Link
                        href={`/patients/${r.id}`}
                        className="block truncate text-base font-medium text-accent-strong hover:underline"
                      >
                        {r.name}
                      </Link>
                      <p className="text-sm text-neutral-600">
                        <span className="tabular-nums">{displayBD(r.phone)}</span>
                        {r.serial_no ? <span className="ml-2 text-neutral-400">{r.serial_no}</span> : null}
                      </p>
                    </div>
                    {r.detail ? (
                      <span className="shrink-0 text-sm text-neutral-500">{r.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {recipients.length > PREVIEW_ROWS ? (
                <p className="mt-2 text-sm text-neutral-500">
                  and {recipients.length - PREVIEW_ROWS} more.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className={`${cardClass} p-5`} aria-labelledby="compose-heading">
          <h2 id="compose-heading" className="mb-4 text-base font-semibold text-neutral-900">
            Message to {audienceLabel.toLowerCase()}
          </h2>
          <ComposeForm
            key={segmentQuery(filter) + initialBody}
            hidden={hidden}
            recipientCount={recipients.length}
            audienceLabel={audienceLabel}
            pricePerSegment={price}
            templates={templates}
            initialBody={initialBody}
            fills={fills}
          />
        </section>
      </div>
      )}

      <section className="mt-10" aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-lg font-semibold text-neutral-900">
          Sent before
        </h2>
        {campaigns.length === 0 ? (
          <div className={`${cardClass} p-8 text-center`}>
            <p className="text-base text-neutral-600">Nothing sent yet.</p>
          </div>
        ) : (
          <ol className={`${cardClass} divide-y divide-neutral-100`}>
            {campaigns.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-base font-medium text-neutral-900">{c.name ?? "Message"}</p>
                  <p className="text-sm tabular-nums text-neutral-500">{formatDateTime(c.created_at)}</p>
                </div>
                <p className="mt-1 line-clamp-2 text-base text-neutral-800" lang="bn">
                  {c.body}
                </p>
                <p className="mt-2 text-sm text-neutral-600">
                  <span className="tabular-nums">{c.recipient_count}</span>{" "}
                  {c.recipient_count === 1 ? "patient" : "patients"}
                  {c.failed_count ? (
                    <span className="ml-2 text-red-700">{c.failed_count} failed</span>
                  ) : null}
                  <Link
                    href={`/outbox?campaign=${c.id}`}
                    className="ml-3 font-medium text-accent-strong hover:underline"
                  >
                    Open in Outbox
                  </Link>
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
