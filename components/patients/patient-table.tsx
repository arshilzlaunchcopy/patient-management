import Link from "next/link";
import { displayBD } from "@/lib/phone";
import { formatDate, isPastDate } from "@/lib/dates";
import { ageSexLabel } from "@/components/patients/labels";
import type { PatientListRow } from "@/lib/patients/queries";
import { cardClass } from "@/components/ui/styles";

const TH = "px-4 py-3 text-left text-sm font-medium text-neutral-600";
const TD = "px-4 py-3 align-top text-base text-neutral-800";

function NextVisit({ date }: { date: string | null }) {
  if (!date) return <span className="text-neutral-400">—</span>;
  const overdue = isPastDate(date);
  return (
    <span className={overdue ? "text-red-700" : undefined}>
      {formatDate(date)}
      {overdue ? (
        <span className="ml-2 text-xs font-medium uppercase tracking-wide">overdue</span>
      ) : null}
    </span>
  );
}

/**
 * A table on a laptop; on a phone the same rows become tappable cards, so
 * nothing needs to be scrolled sideways and the whole card opens the patient.
 */
export function PatientTable({ rows }: { rows: PatientListRow[] }) {
  return (
    <>
      <ul className={`${cardClass} divide-y divide-neutral-100 md:hidden`}>
        {rows.map((p) => (
          <li key={p.id}>
            <Link href={`/patients/${p.id}`} className="block px-4 py-3 active:bg-neutral-50">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-base font-medium text-accent-strong">{p.name}</span>
                {p.serial_no ? (
                  <span className="shrink-0 text-sm text-neutral-500">{p.serial_no}</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-neutral-600">
                <span className="tabular-nums">{displayBD(p.phone)}</span>
                {ageSexLabel(p) ? <span className="ml-2">{ageSexLabel(p)}</span> : null}
                {p.diabetes_type ? <span className="ml-2">{p.diabetes_type}</span> : null}
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                {p.last_visit_date ? (
                  <>
                    Last {formatDate(p.last_visit_date)}
                    <span className="mx-1.5 text-neutral-300">·</span>
                  </>
                ) : (
                  <span className="text-neutral-400">No visits · </span>
                )}
                Next <NextVisit date={p.next_visit_date} />
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className={`${cardClass} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[720px] border-collapse">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className={TH}>Serial</th>
              <th className={TH}>Name</th>
              <th className={TH}>Age / Sex</th>
              <th className={TH}>Phone</th>
              <th className={TH}>Type</th>
              <th className={TH}>Last visit</th>
              <th className={TH}>Next visit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className={`${TD} whitespace-nowrap text-neutral-500`}>{p.serial_no ?? "—"}</td>
                <td className={TD}>
                  <Link
                    href={`/patients/${p.id}`}
                    className="font-medium text-accent-strong hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className={`${TD} whitespace-nowrap`}>{ageSexLabel(p) || "—"}</td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>{displayBD(p.phone)}</td>
                <td className={`${TD} whitespace-nowrap`}>{p.diabetes_type ?? "—"}</td>
                <td className={`${TD} whitespace-nowrap`}>
                  {formatDate(p.last_visit_date) || <span className="text-neutral-400">No visits</span>}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  <NextVisit date={p.next_visit_date} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
