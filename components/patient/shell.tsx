/**
 * Building blocks for patient-facing pages. Large text, large targets,
 * no animation, no JavaScript unless a specific component needs it.
 */

export const bigButtonClass =
  "flex min-h-14 w-full items-center justify-center rounded-lg bg-accent px-5 text-xl font-semibold text-white active:bg-accent-strong";

export const bigButtonSecondaryClass =
  "flex min-h-14 w-full items-center justify-center rounded-lg border-2 border-neutral-300 bg-white px-5 text-xl font-medium text-neutral-900 active:bg-neutral-100";

export const bigInputClass =
  "block min-h-14 w-full rounded-lg border-2 border-neutral-300 bg-white px-4 text-xl text-neutral-900 focus:border-accent focus:outline-none";

export const bigLabelClass = "block text-lg font-medium text-neutral-900";

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">{children}</div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const cls = {
    info: "border-neutral-200 bg-neutral-50 text-neutral-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-accent bg-accent-soft text-accent-strong",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`rounded-lg border p-4 text-lg ${cls}`}>
      {children}
    </div>
  );
}
