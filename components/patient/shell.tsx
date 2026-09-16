import { bn } from "@/lib/i18n/bn";
import { toBengaliDigits } from "@/lib/i18n/format";

/**
 * Building blocks for patient-facing pages. Large text, large targets,
 * no animation, no JavaScript unless a specific component needs it.
 */

export const bigButtonClass =
  "flex min-h-14 w-full items-center justify-center rounded-xl bg-accent px-5 text-xl font-semibold text-white active:bg-accent-strong";

export const bigButtonSecondaryClass =
  "flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-neutral-300 bg-white px-5 text-xl font-medium text-neutral-900 active:bg-neutral-100";

export const bigInputClass =
  "block min-h-14 w-full rounded-xl border-2 border-neutral-300 bg-white px-4 text-xl text-neutral-900 focus:border-accent focus:outline-none";

export const bigLabelClass = "block text-lg font-medium text-neutral-900";

export function Card({
  tone = "default",
  children,
}: {
  tone?: "default" | "accent";
  children: React.ReactNode;
}) {
  const cls =
    tone === "accent"
      ? "border-accent/40 bg-accent-soft/40"
      : "border-neutral-200 bg-white";
  return <div className={`rounded-xl border p-5 ${cls}`}>{children}</div>;
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
    <div role={tone === "error" ? "alert" : undefined} className={`rounded-xl border p-4 text-lg ${cls}`}>
      {children}
    </div>
  );
}

/** Page heading with an optional one-line hint under it. */
export function PageTitle({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold leading-snug">{children}</h1>
      {help ? <p className="mt-1 text-base text-neutral-600">{help}</p> : null}
    </div>
  );
}

/**
 * Where the patient is in the booking: four dots with labels. Pure markup,
 * so it costs nothing on a slow connection.
 */
export function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const total = bn.steps.length;
  return (
    <nav aria-label={bn.stepOf(toBengaliDigits(current), toBengaliDigits(total))} className="mb-5">
      <ol className="flex items-start justify-between gap-1">
        {bn.steps.map((label, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "todo";
          return (
            <li key={label} className="flex flex-1 flex-col items-center text-center">
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold tabular-nums",
                  state === "done"
                    ? "bg-accent text-white"
                    : state === "current"
                      ? "border-2 border-accent bg-white text-accent-strong"
                      : "border-2 border-neutral-300 bg-white text-neutral-400",
                ].join(" ")}
              >
                {state === "done" ? "✓" : toBengaliDigits(n)}
              </span>
              <span
                className={`mt-1 text-sm leading-tight ${
                  state === "current" ? "font-semibold text-accent-strong" : "text-neutral-600"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
