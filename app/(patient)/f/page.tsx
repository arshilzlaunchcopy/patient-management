import { bn } from "@/lib/i18n/bn";
import {
  bigButtonClass,
  bigInputClass,
  bigLabelClass,
  Notice,
} from "@/components/patient/shell";

export const dynamic = "force-dynamic";

/** Lost-link fallback. The response never reveals whether a number is registered. */
export default async function LostLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold">{bn.followup.lostHeading}</h1>
      <p className="mt-1 text-base text-neutral-600">{bn.followup.lostIntro}</p>

      {sent ? (
        <div className="mt-6">
          <Notice tone="success">{bn.followup.sentMessage}</Notice>
        </div>
      ) : (
        <form action="/api/followup/request" method="post" className="mt-6 space-y-5">
          {error === "phone" ? <Notice tone="error">{bn.errors.phone}</Notice> : null}
          <div>
            <label htmlFor="phone" className={bigLabelClass}>
              {bn.followup.phone}
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
            {bn.followup.send}
          </button>
        </form>
      )}
    </>
  );
}
