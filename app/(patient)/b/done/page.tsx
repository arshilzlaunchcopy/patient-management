import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { resolvePaymentToken } from "@/lib/booking/tokens";
import { bn } from "@/lib/i18n/bn";
import { formatDateLongBn, formatWindowBn, toBengaliDigits } from "@/lib/i18n/format";
import type { ConsultDay } from "@/lib/types";
import { bigButtonClass, Card, Notice, Steps } from "@/components/patient/shell";

export const dynamic = "force-dynamic";

export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const supabase = createServiceClient();
  const ctx = t ? await resolvePaymentToken(supabase, t) : null;

  if (!ctx) {
    return (
      <>
        <Notice tone="error">{bn.expiredLink}</Notice>
        <Link href="/b" className={`${bigButtonClass} mt-6`}>
          {bn.bookAgain}
        </Link>
      </>
    );
  }

  const { appointment } = ctx;
  if (appointment.status === "hold") redirect(`/b/pay/${t}`);

  const { data } = await supabase
    .from("consult_days")
    .select("call_start, call_end")
    .eq("date", appointment.scheduled_date)
    .eq("mode", "video")
    .maybeSingle();
  const day = data as Pick<ConsultDay, "call_start" | "call_end"> | null;
  const w = day ? formatWindowBn(day.call_start, day.call_end) : null;

  return (
    <>
      <Steps current={4} />
      <Notice tone="success">
        <p className="text-xl font-semibold">{bn.doneHeading}</p>
      </Notice>

      <div className="mt-5">
        <Card tone="accent">
          <p className="text-lg text-neutral-600">{bn.serial}</p>
          <p className="text-6xl font-bold tabular-nums leading-tight text-accent-strong">
            {appointment.queue_no !== null ? toBengaliDigits(appointment.queue_no) : "—"}
          </p>
          <p className="mt-4 text-xl font-medium">
            {w
              ? bn.doneCall(formatDateLongBn(appointment.scheduled_date), w.start, w.end)
              : formatDateLongBn(appointment.scheduled_date)}
          </p>
        </Card>
      </div>

      <p className="mt-5 text-lg">{bn.doneSms}</p>
      <p className="mt-2 text-base text-neutral-600">{bn.doneKeep}</p>
    </>
  );
}
