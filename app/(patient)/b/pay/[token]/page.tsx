import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { resolvePaymentToken } from "@/lib/booking/tokens";
import { getSettings } from "@/lib/settings";
import { displayBD } from "@/lib/phone";
import { bn } from "@/lib/i18n/bn";
import { formatDateLongBn, toBengaliDigits } from "@/lib/i18n/format";
import { bigButtonClass, Card, Notice, PageTitle, Steps } from "@/components/patient/shell";
import { Countdown } from "@/components/patient/countdown";
import { CopyButton } from "@/components/patient/copy-button";

export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();
  const ctx = await resolvePaymentToken(supabase, token);

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

  // Already submitted proof (or verified): show the result instead.
  if (appointment.status !== "hold") {
    redirect(`/b/done?t=${token}`);
  }

  const expiresAt = appointment.hold_expires_at;
  if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
    return (
      <>
        <Notice tone="error">{bn.holdExpired}</Notice>
        <Link href="/b" className={`${bigButtonClass} mt-6`}>
          {bn.bookAgain}
        </Link>
      </>
    );
  }

  const settings = await getSettings(["bkash_number"] as const, supabase);
  const bkash = displayBD(settings.bkash_number ?? "") || settings.bkash_number || "";
  const amount = toBengaliDigits(Math.round(Number(appointment.fee_amount ?? 0)));

  return (
    <>
      <Steps current={3} />
      <PageTitle help={formatDateLongBn(appointment.scheduled_date)}>{bn.payHeading}</PageTitle>

      <div className="mt-5 space-y-4">
        <Card>
          <p className="text-lg leading-relaxed">
            {bn.payInstructionBefore}{" "}
            <strong className="text-2xl">{bn.taka(amount)}</strong>{" "}
            {bn.payInstructionMiddle} <strong>{bn.sendMoney}</strong> {bn.payInstructionAfter}
          </p>
        </Card>

        <Card tone="accent">
          <p className="text-base text-neutral-600">{bn.bkashNumber}</p>
          <p id="bkash-number" className="my-2 text-3xl font-semibold tabular-nums tracking-wide">
            {bkash}
          </p>
          <CopyButton value={bkash} label={bn.copy} doneLabel={bn.copied} />
        </Card>

        <Card>
          <p className="text-base font-semibold text-neutral-800">{bn.payStepsHeading}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-base text-neutral-800">
            {bn.paySteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>

        <Card>
          <Countdown expiresAt={expiresAt} label={bn.countdown} />
          <p className="mt-1 text-base text-neutral-600">{bn.countdownHelp}</p>
        </Card>

        <Link href={`/b/pay/${token}/proof`} className={bigButtonClass}>
          {bn.paid}
        </Link>
      </div>
    </>
  );
}
