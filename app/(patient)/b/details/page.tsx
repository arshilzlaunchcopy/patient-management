import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getDayAvailability } from "@/lib/availability";
import { isIsoDate, todayDhaka } from "@/lib/dates";
import { bn } from "@/lib/i18n/bn";
import { formatDateLongBn, formatWindowBn } from "@/lib/i18n/format";
import {
  bigButtonClass,
  bigInputClass,
  bigLabelClass,
  Card,
  Notice,
  PageTitle,
  Steps,
} from "@/components/patient/shell";

export const dynamic = "force-dynamic";

const ERROR_KEYS = ["name", "phone", "date", "full", "closed", "generic"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

export default async function DetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string }>;
}) {
  const { date, error } = await searchParams;
  if (!date || !isIsoDate(date) || date < todayDhaka()) redirect("/b");

  const supabase = createServiceClient();
  const { day, full } = await getDayAvailability(supabase, date);
  const bookable = !!day && day.is_open_for_new && !day.is_cancelled && !full;
  const errorKey = ERROR_KEYS.find((k) => k === error) as ErrorKey | undefined;
  const w = day ? formatWindowBn(day.call_start, day.call_end) : null;

  return (
    <>
      <Steps current={2} />
      <PageTitle>{bn.yourDetails}</PageTitle>

      <div className="mt-4">
        <Card tone="accent">
          <p className="text-base text-neutral-600">{bn.selectedDate}</p>
          <p className="text-xl font-semibold">{formatDateLongBn(date)}</p>
          {w ? <p className="mt-1 text-base">{bn.callWindow(w.start, w.end)}</p> : null}
          <Link href="/b" className="mt-2 inline-block text-base text-accent-strong underline">
            {bn.changeDate}
          </Link>
        </Card>
      </div>

      {!bookable ? (
        <div className="mt-4">
          <Notice tone="error">{full ? bn.dayFull : bn.errors.closed}</Notice>
          <Link href="/b" className={`${bigButtonClass} mt-4`}>
            {bn.changeDate}
          </Link>
        </div>
      ) : (
        <form action="/api/book/create" method="post" className="mt-6 space-y-5">
          <input type="hidden" name="date" value={date} />

          {errorKey ? <Notice tone="error">{bn.errors[errorKey]}</Notice> : null}

          <div>
            <label htmlFor="name" className={bigLabelClass}>
              {bn.name}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              autoComplete="name"
              className={`${bigInputClass} mt-2`}
            />
          </div>

          <div>
            <label htmlFor="phone" className={bigLabelClass}>
              {bn.whatsapp}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              required
              placeholder={bn.phonePlaceholder}
              autoComplete="tel"
              className={`${bigInputClass} mt-2 tabular-nums`}
            />
          </div>

          <button type="submit" className={bigButtonClass}>
            {bn.next}
          </button>
        </form>
      )}
    </>
  );
}
