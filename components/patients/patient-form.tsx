"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import type { PatientFormState } from "@/lib/patients/actions";
import type { PatientInput } from "@/lib/patients/validation";
import { DIABETES_TYPES, SEX_OPTIONS } from "@/lib/types";
import { displayBD } from "@/lib/phone";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  errorClass,
  helpClass,
  inputClass,
  labelClass,
} from "@/components/ui/styles";

type Action = (
  prev: PatientFormState,
  formData: FormData,
) => Promise<PatientFormState>;

const SEX_LABELS: Record<(typeof SEX_OPTIONS)[number], string> = {
  M: "Male",
  F: "Female",
  Other: "Other",
};

function Field({
  name,
  label,
  error,
  help,
  children,
}: {
  name: keyof PatientInput;
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className={errorClass}>
          {error}
        </p>
      ) : help ? (
        <p className={helpClass}>{help}</p>
      ) : null}
    </div>
  );
}

export function PatientForm({
  action,
  initial,
  submitLabel,
  cancelHref,
}: {
  action: Action;
  initial?: Partial<PatientInput>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};
  const v = initial ?? {};

  const attrs = (name: keyof PatientInput) => ({
    id: name,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    className: inputClass,
  });

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
      className={`${cardClass} p-6 md:p-8`}
    >
      {state.conflict ? (
        <div
          role="alert"
          className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-base text-red-800"
        >
          This phone number already belongs to{" "}
          <Link
            href={`/patients/${state.conflict.id}`}
            className="font-medium underline"
          >
            {state.conflict.name}
            {state.conflict.serial_no ? ` (${state.conflict.serial_no})` : ""}
          </Link>
          . Open that record instead of creating a duplicate.
        </div>
      ) : null}

      {state.message ? (
        <div
          role="alert"
          className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-base text-red-800"
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field name="name" label="Full name" error={errors.name}>
            <input
              {...attrs("name")}
              type="text"
              required
              defaultValue={v.name ?? ""}
              autoComplete="off"
            />
          </Field>
        </div>

        <Field
          name="phone"
          label="Mobile number"
          error={errors.phone}
          help="Any format is fine. Stored as 01XXXXXXXXX."
        >
          <input
            {...attrs("phone")}
            type="tel"
            inputMode="numeric"
            required
            defaultValue={v.phone ? displayBD(v.phone) : ""}
            autoComplete="off"
          />
        </Field>

        <Field
          name="alt_phone"
          label="Alternative number"
          error={errors.alt_phone}
        >
          <input
            {...attrs("alt_phone")}
            type="tel"
            inputMode="numeric"
            defaultValue={v.alt_phone ? displayBD(v.alt_phone) : ""}
            autoComplete="off"
          />
        </Field>

        <Field name="sex" label="Sex" error={errors.sex}>
          <select {...attrs("sex")} defaultValue={v.sex ?? ""}>
            <option value="">—</option>
            {SEX_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SEX_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          name="diabetes_type"
          label="Diabetes type"
          error={errors.diabetes_type}
        >
          <select
            {...attrs("diabetes_type")}
            defaultValue={v.diabetes_type ?? ""}
          >
            <option value="">—</option>
            {DIABETES_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field
          name="date_of_birth"
          label="Date of birth"
          error={errors.date_of_birth}
          help="If known. Otherwise enter the age."
        >
          <input
            {...attrs("date_of_birth")}
            type="date"
            defaultValue={v.date_of_birth ?? ""}
          />
        </Field>

        <Field name="age_years" label="Age (years)" error={errors.age_years}>
          <input
            {...attrs("age_years")}
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            defaultValue={v.age_years ?? ""}
          />
        </Field>

        <Field
          name="diagnosed_on"
          label="Diagnosed on"
          error={errors.diagnosed_on}
        >
          <input
            {...attrs("diagnosed_on")}
            type="date"
            defaultValue={v.diagnosed_on ?? ""}
          />
        </Field>

        <div className="md:col-span-2">
          <Field name="address" label="Address" error={errors.address}>
            <input
              {...attrs("address")}
              type="text"
              defaultValue={v.address ?? ""}
              autoComplete="off"
            />
          </Field>
        </div>

        <Field
          name="comorbidities"
          label="Comorbidities"
          error={errors.comorbidities}
        >
          <textarea
            {...attrs("comorbidities")}
            rows={3}
            defaultValue={v.comorbidities ?? ""}
          />
        </Field>

        <Field name="allergies" label="Allergies" error={errors.allergies}>
          <textarea
            {...attrs("allergies")}
            rows={3}
            defaultValue={v.allergies ?? ""}
          />
        </Field>

        <div className="md:col-span-2">
          <Field name="notes" label="Notes" error={errors.notes}>
            <textarea
              {...attrs("notes")}
              rows={4}
              defaultValue={v.notes ?? ""}
            />
          </Field>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} className={buttonSecondaryClass}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
