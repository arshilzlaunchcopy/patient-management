"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import type { VisitFormState } from "@/lib/visits/actions";
import type { VisitInput } from "@/lib/visits/validation";
import { addMonths, formatDate } from "@/lib/dates";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  errorClass,
  inputClass,
  labelClass,
} from "@/components/ui/styles";

type Action = (
  prev: VisitFormState,
  formData: FormData,
) => Promise<VisitFormState>;

type NumKey =
  | "weight_kg"
  | "height_cm"
  | "bp_systolic"
  | "bp_diastolic"
  | "fbs"
  | "rbs"
  | "hba1c"
  | "creatinine";

const MEASUREMENTS: { key: NumKey; label: string; unit: string; integer?: boolean }[] = [
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "height_cm", label: "Height", unit: "cm" },
  { key: "bp_systolic", label: "BP systolic", unit: "mmHg", integer: true },
  { key: "bp_diastolic", label: "BP diastolic", unit: "mmHg", integer: true },
  { key: "fbs", label: "Fasting sugar", unit: "mmol/L" },
  { key: "rbs", label: "Random sugar", unit: "mmol/L" },
  { key: "hba1c", label: "HbA1c", unit: "%" },
  { key: "creatinine", label: "Creatinine", unit: "mg/dL" },
];

const NOTES: { key: keyof VisitInput; label: string; rows: number }[] = [
  { key: "complaints", label: "Complaints", rows: 3 },
  { key: "examination", label: "Examination", rows: 3 },
  { key: "diagnosis", label: "Diagnosis", rows: 2 },
  { key: "prescription", label: "Prescription", rows: 6 },
  { key: "advice", label: "Advice", rows: 3 },
];

const QUICK = [
  { label: "+1 month", months: 1 },
  { label: "+3 months", months: 3 },
  { label: "+6 months", months: 6 },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-base font-semibold text-neutral-900">{children}</h2>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className={errorClass}>
      {message}
    </p>
  ) : null;
}

export function VisitForm({
  action,
  patientId,
  defaultDate,
  defaultMode,
  fees,
  cancelHref,
}: {
  action: Action;
  patientId: string;
  defaultDate: string;
  defaultMode: VisitInput["mode"];
  fees: { in_person: number; video: number };
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};

  const [visitDate, setVisitDate] = useState(defaultDate);
  const [mode, setMode] = useState<VisitInput["mode"]>(defaultMode);
  const [fee, setFee] = useState(String(fees[defaultMode]));
  const [feeTouched, setFeeTouched] = useState(false);
  const [nextVisit, setNextVisit] = useState("");

  const invalid = (k: keyof VisitInput) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `${k}-error` : undefined,
  });

  function changeMode(next: VisitInput["mode"]) {
    setMode(next);
    if (!feeTouched) setFee(String(fees[next]));
  }

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        // Submit through a transition so React does not reset the
        // uncontrolled fields when the action returns validation errors.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-6"
    >
      <input type="hidden" name="patient_id" value={patientId} />

      {state.message ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-base text-red-800"
        >
          {state.message}
        </div>
      ) : null}

      {/* Visit */}
      <section className={`${cardClass} p-6`}>
        <SectionTitle>Visit</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="visit_date" className={labelClass}>
              Date
            </label>
            <input
              id="visit_date"
              name="visit_date"
              type="date"
              required
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className={inputClass}
              {...invalid("visit_date")}
            />
            <FieldError id="visit_date-error" message={errors.visit_date} />
          </div>
          <div>
            <span className={labelClass}>Mode</span>
            <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label="Mode">
              {(
                [
                  ["in_person", "Chamber"],
                  ["video", "Video"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={[
                    "flex flex-1 cursor-pointer items-center justify-center rounded-md border px-4 py-2.5 text-base",
                    mode === value
                      ? "border-accent bg-accent-soft font-medium text-accent-strong"
                      : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => changeMode(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            <FieldError id="mode-error" message={errors.mode} />
          </div>
        </div>
      </section>

      {/* Measurements */}
      <section className={`${cardClass} p-6`}>
        <SectionTitle>Measurements</SectionTitle>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {MEASUREMENTS.map((m) => (
            <div key={m.key}>
              <label htmlFor={m.key} className={labelClass}>
                {m.label}{" "}
                <span className="font-normal text-neutral-500">{m.unit}</span>
              </label>
              <input
                id={m.key}
                name={m.key}
                type="text"
                inputMode={m.integer ? "numeric" : "decimal"}
                autoComplete="off"
                className={`${inputClass} tabular-nums`}
                {...invalid(m.key)}
              />
              <FieldError id={`${m.key}-error`} message={errors[m.key]} />
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className={`${cardClass} p-6`}>
        <SectionTitle>Notes</SectionTitle>
        <div className="grid gap-5 md:grid-cols-2">
          {NOTES.map((n) => (
            <div
              key={n.key}
              className={n.key === "prescription" ? "md:col-span-2" : undefined}
            >
              <label htmlFor={n.key} className={labelClass}>
                {n.label}
              </label>
              <textarea
                id={n.key}
                name={n.key}
                rows={n.rows}
                className={inputClass}
                {...invalid(n.key)}
              />
              <FieldError id={`${n.key}-error`} message={errors[n.key]} />
            </div>
          ))}
        </div>
      </section>

      {/* Payment + next visit */}
      <section className={`${cardClass} p-6`}>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <SectionTitle>Payment</SectionTitle>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label htmlFor="fee_charged" className={labelClass}>
                  Fee{" "}
                  <span className="font-normal text-neutral-500">৳</span>
                </label>
                <input
                  id="fee_charged"
                  name="fee_charged"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={fee}
                  onChange={(e) => {
                    setFee(e.target.value);
                    setFeeTouched(true);
                  }}
                  className={`${inputClass} tabular-nums`}
                  {...invalid("fee_charged")}
                />
                <FieldError id="fee_charged-error" message={errors.fee_charged} />
              </div>
              <div>
                <label htmlFor="payment_method" className={labelClass}>
                  Method
                </label>
                <select
                  id="payment_method"
                  name="payment_method"
                  defaultValue="cash"
                  className={inputClass}
                  {...invalid("payment_method")}
                >
                  <option value="cash">Cash</option>
                  <option value="bkash">bKash</option>
                  <option value="free">Free</option>
                </select>
                <FieldError
                  id="payment_method-error"
                  message={errors.payment_method}
                />
              </div>
            </div>
          </div>

          <div>
            <SectionTitle>Next visit</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((q) => {
                const target = addMonths(visitDate, q.months);
                const active = nextVisit === target;
                return (
                  <button
                    key={q.months}
                    type="button"
                    onClick={() => setNextVisit(active ? "" : target)}
                    aria-pressed={active}
                    className={[
                      "rounded-md border px-4 py-2.5 text-base",
                      active
                        ? "border-accent bg-accent-soft font-medium text-accent-strong"
                        : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <label htmlFor="next_visit_date" className={labelClass}>
                Or pick a date
              </label>
              <input
                id="next_visit_date"
                name="next_visit_date"
                type="date"
                min={visitDate}
                value={nextVisit}
                onChange={(e) => setNextVisit(e.target.value)}
                className={inputClass}
                {...invalid("next_visit_date")}
              />
              <FieldError
                id="next_visit_date-error"
                message={errors.next_visit_date}
              />
              <p className="mt-2 text-sm text-neutral-600">
                {nextVisit
                  ? `Follow-up on ${formatDate(nextVisit)}. A video consult day will be created for it if none exists.`
                  : "No follow-up date set."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? "Saving…" : "Save visit"}
        </button>
        <Link href={cancelHref} className={buttonSecondaryClass}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
