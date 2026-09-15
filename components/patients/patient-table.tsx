import Link from "next/link";
import { displayBD } from "@/lib/phone";
import { formatDate, isPastDate } from "@/lib/dates";
import { ageSexLabel } from "@/components/patients/labels";
import type { PatientListRow } from "@/lib/patients/queries";
import { cardClass } from "@/components/ui/styles";

const TH = "px-4 py-3 text-left text-sm font-medium text-neutral-600";
const TD = "px-4 py-3 align-top text-base text-neutral-800";

export function PatientTable({ rows }: { rows: PatientListRow[] }) {
  return (
    <div className={`${cardClass} overflow-x-auto`}>
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
          {rows.map((p) => {
            const overdue = isPastDate(p.next_visit_date);
            return (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className={`${TD} whitespace-nowrap text-neutral-500`}>
                  {p.serial_no ?? "—"}
                </td>
                <td className={TD}>
                  <Link
                    href={`/patients/${p.id}`}
                    className="font-medium text-accent-strong hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {ageSexLabel(p) || "—"}
                </td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>
                  {displayBD(p.phone)}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {p.diabetes_type ?? "—"}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {formatDate(p.last_visit_date) || (
                    <span className="text-neutral-400">No visits</span>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {p.next_visit_date ? (
                    <span className={overdue ? "text-red-700" : undefined}>
                      {formatDate(p.next_visit_date)}
                      {overdue ? (
                        <span className="ml-2 text-xs font-medium uppercase tracking-wide">
                          overdue
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
