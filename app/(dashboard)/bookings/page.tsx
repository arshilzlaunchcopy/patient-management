import type { Metadata } from "next";
import Link from "next/link";
import {
  findMergeCandidates,
  listClaims,
  listHolds,
  listPendingPatients,
  listVerifiedClaims,
  VERIFIED_LIMIT,
} from "@/lib/bookings/queries";
import { ClaimCard } from "@/components/bookings/claim-card";
import { PendingCard } from "@/components/bookings/pending-card";
import { HoldCard } from "@/components/bookings/hold-card";
import { VerifiedList } from "@/components/bookings/verified-list";
import { cardClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Bookings" };

const TABS = [
  { key: "verify", label: "Needs verification" },
  { key: "new", label: "New patients" },
  { key: "holds", label: "Holds" },
  { key: "verified", label: "Verified payments" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const MESSAGES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  verified: { text: "Verified. Confirmation SMS queued.", tone: "ok" },
  rejected: { text: "Rejected. The patient has 24 hours and a new link to try again.", tone: "ok" },
  merged: { text: "Merged. The duplicate record is gone.", tone: "ok" },
  accepted: { text: "Accepted. Serial number assigned.", tone: "ok" },
  released: { text: "Hold released.", tone: "ok" },
  conflict: { text: "Cannot merge: both patients have a live booking on the same date.", tone: "warn" },
  error: { text: "That item is no longer in the state it was. Refresh and try again.", tone: "warn" },
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cardClass} p-10 text-center`}>
      <p className="text-base text-neutral-700">{children}</p>
    </div>
  );
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; msg?: string; merge?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "verify";
  const merge = sp.merge ?? "";
  const q = (sp.q ?? "").trim();
  const message = sp.msg ? MESSAGES[sp.msg] : undefined;

  const [claims, pending, holds, verified] = await Promise.all([
    listClaims(),
    listPendingPatients(),
    listHolds(),
    tab === "verified" ? listVerifiedClaims() : Promise.resolve([]),
  ]);
  const candidates = merge && q ? await findMergeCandidates(q, merge) : [];

  // Counts are work waiting; the verified tab is a record, so it shows none.
  const counts: Partial<Record<Tab, number>> = {
    verify: claims.length,
    new: pending.length,
    holds: holds.length,
  };

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Bookings</h1>
        <p className="mt-1 text-base text-neutral-600">
          Check each payment against bKash, then verify or reject. Oldest first.
        </p>
      </header>

      <nav
        aria-label="Booking tabs"
        className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-neutral-200 px-4 md:mx-0 md:px-0"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          const count = counts[t.key] ?? 0;
          return (
            <Link
              key={t.key}
              href={`/bookings?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={[
                "-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-base transition-colors md:px-4",
                active
                  ? "border-accent font-medium text-accent-strong"
                  : "border-transparent text-neutral-600 hover:text-neutral-900",
              ].join(" ")}
            >
              {t.label}
              {count > 0 ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    active ? "bg-accent text-white" : "bg-neutral-200 text-neutral-700"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {message ? (
        <p
          role="status"
          className={`mb-6 rounded-md border p-3 text-base ${
            message.tone === "ok"
              ? "border-accent bg-accent-soft text-accent-strong"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {tab === "verify" ? (
        claims.length === 0 ? (
          <Empty>Nothing to verify. Payments patients submit will appear here.</Empty>
        ) : (
          <ul className="space-y-4">
            {claims.map((c) => (
              <ClaimCard
                key={c.id}
                claim={c}
                merging={merge === c.appointment.patient.id}
                mergeQuery={q}
                candidates={candidates}
              />
            ))}
          </ul>
        )
      ) : tab === "new" ? (
        pending.length === 0 ? (
          <Empty>No new self-registrations waiting.</Empty>
        ) : (
          <ul className="space-y-4">
            {pending.map((p) => (
              <PendingCard
                key={p.id}
                patient={p}
                merging={merge === p.id}
                mergeQuery={q}
                candidates={candidates}
              />
            ))}
          </ul>
        )
      ) : tab === "holds" ? (
        holds.length === 0 ? (
          <Empty>No live holds. A hold appears while a patient is on the payment page.</Empty>
        ) : (
          <ul className="space-y-3">
            {holds.map((h) => (
              <HoldCard key={h.id} hold={h} />
            ))}
          </ul>
        )
      ) : verified.length === 0 ? (
        <Empty>No verified online payments yet. Each one you verify is kept here with its patient.</Empty>
      ) : (
        <VerifiedList rows={verified} limit={VERIFIED_LIMIT} />
      )}
    </>
  );
}
