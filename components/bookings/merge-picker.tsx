import Link from "next/link";
import type { MergeCandidate } from "@/lib/bookings/queries";
import { mergePatients } from "@/lib/bookings/actions";
import { displayBD } from "@/lib/phone";
import { buttonSecondaryClass, inputClass } from "@/components/ui/styles";

/**
 * Inline search for the existing patient to merge a duplicate into.
 * Search is a GET form (URL state); each result is a one-click POST.
 */
export function MergePicker({
  tab,
  sourceId,
  q,
  candidates,
}: {
  tab: "verify" | "new";
  sourceId: string;
  q: string;
  candidates: MergeCandidate[];
}) {
  return (
    <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4">
      <form action="/bookings" method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="merge" value={sourceId} />
        <div className="min-w-[14rem] flex-1">
          <label htmlFor={`merge-q-${sourceId}`} className="block text-sm font-medium text-neutral-800">
            Merge into existing patient
          </label>
          <input
            id={`merge-q-${sourceId}`}
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, phone or serial"
            autoComplete="off"
            autoFocus
            className={inputClass}
          />
        </div>
        <button type="submit" className={buttonSecondaryClass}>
          Search
        </button>
        <Link href={`/bookings?tab=${tab}`} className="px-2 py-2.5 text-sm text-neutral-600 hover:underline">
          Cancel
        </Link>
      </form>

      {q ? (
        candidates.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">No active patients match “{q}”.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-base text-neutral-900">
                  {c.name}
                  <span className="ml-2 text-sm text-neutral-500">
                    {c.serial_no ?? ""} <span className="tabular-nums">{displayBD(c.phone)}</span>
                  </span>
                </span>
                <form action={mergePatients}>
                  <input type="hidden" name="tab" value={tab} />
                  <input type="hidden" name="source_id" value={sourceId} />
                  <input type="hidden" name="target_id" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong"
                  >
                    Merge into this
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="mt-3 text-sm text-neutral-600">
          Their bookings and messages move to the patient you pick, and this duplicate is removed.
        </p>
      )}
    </div>
  );
}
