import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { resolvePaymentToken } from "@/lib/booking/tokens";
import { bn } from "@/lib/i18n/bn";
import {
  bigButtonClass,
  bigInputClass,
  bigLabelClass,
  Notice,
} from "@/components/patient/shell";

export const dynamic = "force-dynamic";

const ERROR_KEYS = ["name", "trx", "trxUsed", "sender", "proofRequired", "generic"] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

/**
 * The TrxID / sender-phone toggle is CSS only: each option is a group
 * containing its radio, and the field below it is shown with
 * group-has-[:checked]. No JavaScript needed on a cheap phone.
 */
const optionClass =
  "group rounded-lg border-2 border-neutral-300 bg-white p-4 has-[:checked]:border-accent";
const optionBodyClass = "hidden group-has-[:checked]:block";

export default async function ProofPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; method?: string }>;
}) {
  const [{ token }, { error, method }] = await Promise.all([params, searchParams]);
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
  if (ctx.appointment.status !== "hold") redirect(`/b/done?t=${token}`);
  if (
    !ctx.appointment.hold_expires_at ||
    new Date(ctx.appointment.hold_expires_at).getTime() <= Date.now()
  ) {
    redirect(`/b/pay/${token}`);
  }

  const errorKey = ERROR_KEYS.find((k) => k === error) as ErrorKey | undefined;
  const useSender = method === "sender";

  return (
    <>
      <h1 className="text-2xl font-semibold">{bn.proofHeading}</h1>
      <p className="mt-1 text-base text-neutral-600">{bn.proofHelp}</p>

      <form action="/api/book/claim" method="post" className="mt-6 space-y-5">
        <input type="hidden" name="token" value={token} />

        {errorKey ? <Notice tone="error">{bn.errors[errorKey]}</Notice> : null}

        <div>
          <label htmlFor="claimed_name" className={bigLabelClass}>
            {bn.name}
          </label>
          <input
            id="claimed_name"
            name="claimed_name"
            type="text"
            required
            maxLength={100}
            defaultValue={ctx.patient.name}
            className={`${bigInputClass} mt-2`}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="sr-only">{bn.proofHeading}</legend>

          <div className={optionClass}>
            <label htmlFor="method-trx" className="flex min-h-10 cursor-pointer items-center gap-3 text-lg font-medium">
              <input
                id="method-trx"
                type="radio"
                name="method"
                value="trx"
                defaultChecked={!useSender}
                className="h-6 w-6 shrink-0 accent-accent"
              />
              {bn.trxId}
            </label>
            <div className={optionBodyClass}>
              <label htmlFor="trx_id" className="sr-only">
                {bn.trxId}
              </label>
              <input
                id="trx_id"
                name="trx_id"
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={10}
                placeholder="ABC1234XYZ"
                className={`${bigInputClass} mt-3 uppercase tracking-widest`}
              />
              <p className="mt-1 text-base text-neutral-600">{bn.trxHelp}</p>
            </div>
          </div>

          <p className="text-center text-base text-neutral-500">{bn.or}</p>

          <div className={optionClass}>
            <label htmlFor="method-sender" className="flex min-h-10 cursor-pointer items-center gap-3 text-lg font-medium">
              <input
                id="method-sender"
                type="radio"
                name="method"
                value="sender"
                defaultChecked={useSender}
                className="h-6 w-6 shrink-0 accent-accent"
              />
              {bn.senderNumber}
            </label>
            <div className={optionBodyClass}>
              <label htmlFor="sender_phone" className="sr-only">
                {bn.senderNumber}
              </label>
              <input
                id="sender_phone"
                name="sender_phone"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                placeholder={bn.phonePlaceholder}
                className={`${bigInputClass} mt-3 tabular-nums`}
              />
            </div>
          </div>
        </fieldset>

        <button type="submit" className={bigButtonClass}>
          {bn.submit}
        </button>
      </form>
    </>
  );
}
