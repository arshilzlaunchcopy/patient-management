"use client";

import { startTransition, useActionState } from "react";
import { saveSettings, type SettingsFormState } from "@/lib/settings/actions";
import type { SettingKey } from "@/lib/settings";
import {
  buttonPrimaryClass,
  cardClass,
  errorClass,
  helpClass,
  inputClass,
  labelClass,
} from "@/components/ui/styles";

type Values = Record<SettingKey, string>;

function Field({
  name,
  label,
  help,
  errors,
  children,
}: {
  name: SettingKey;
  label: string;
  help?: string;
  errors: SettingsFormState["errors"];
  children: React.ReactNode;
}) {
  const error = errors?.[name];
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? <p className={errorClass}>{error}</p> : help ? <p className={helpClass}>{help}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${cardClass} p-6`}>
      <h2 className="mb-4 text-base font-semibold text-neutral-900">{title}</h2>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SettingsForm({ values }: { values: Values }) {
  const [state, formAction, pending] = useActionState(saveSettings, {});
  const errors = state.errors;
  const inv = (k: SettingKey) => ({ "aria-invalid": errors?.[k] ? true : undefined });

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-6"
    >
      {state.message ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-base text-red-800">
          {state.message}
        </p>
      ) : null}

      <Section title="Clinic">
        <Field name="doctor_name_en" label="Doctor name (English)" errors={errors}>
          <input id="doctor_name_en" name="doctor_name_en" type="text" defaultValue={values.doctor_name_en} className={inputClass} {...inv("doctor_name_en")} />
        </Field>
        <Field name="doctor_name_bn" label="Doctor name (Bangla)" errors={errors}>
          <input id="doctor_name_bn" name="doctor_name_bn" type="text" lang="bn" defaultValue={values.doctor_name_bn} className={inputClass} {...inv("doctor_name_bn")} />
        </Field>
        <Field name="clinic_name_bn" label="Clinic name (Bangla)" errors={errors}>
          <input id="clinic_name_bn" name="clinic_name_bn" type="text" lang="bn" defaultValue={values.clinic_name_bn} className={inputClass} />
        </Field>
      </Section>

      <Section title="Payments and contact">
        <Field name="bkash_number" label="bKash number" help="Shown to patients on the payment page." errors={errors}>
          <input id="bkash_number" name="bkash_number" type="tel" inputMode="numeric" defaultValue={values.bkash_number} className={`${inputClass} tabular-nums`} {...inv("bkash_number")} />
        </Field>
        <Field name="whatsapp_number" label="WhatsApp number" help="The number patients are called from." errors={errors}>
          <input id="whatsapp_number" name="whatsapp_number" type="tel" inputMode="numeric" defaultValue={values.whatsapp_number} className={`${inputClass} tabular-nums`} {...inv("whatsapp_number")} />
        </Field>
        <Field name="video_fee" label="Video consultation fee (৳)" errors={errors}>
          <input id="video_fee" name="video_fee" type="text" inputMode="numeric" defaultValue={values.video_fee} className={`${inputClass} tabular-nums`} {...inv("video_fee")} />
        </Field>
        <Field name="in_person_fee" label="Chamber visit fee (৳)" errors={errors}>
          <input id="in_person_fee" name="in_person_fee" type="text" inputMode="numeric" defaultValue={values.in_person_fee} className={`${inputClass} tabular-nums`} {...inv("in_person_fee")} />
        </Field>
      </Section>

      <Section title="Consultation days">
        <Field name="default_call_start" label="Default calls from" errors={errors}>
          <input id="default_call_start" name="default_call_start" type="time" defaultValue={values.default_call_start} className={inputClass} {...inv("default_call_start")} />
        </Field>
        <Field name="default_call_end" label="Default calls until" errors={errors}>
          <input id="default_call_end" name="default_call_end" type="time" defaultValue={values.default_call_end} className={inputClass} {...inv("default_call_end")} />
        </Field>
        <Field name="default_capacity" label="Default capacity" help="Video patients per evening for newly opened days." errors={errors}>
          <input id="default_capacity" name="default_capacity" type="text" inputMode="numeric" defaultValue={values.default_capacity} className={`${inputClass} tabular-nums`} {...inv("default_capacity")} />
        </Field>
        <Field name="hold_minutes" label="Hold minutes" help="How long a patient has to pay before the place is released." errors={errors}>
          <input id="hold_minutes" name="hold_minutes" type="text" inputMode="numeric" defaultValue={values.hold_minutes} className={`${inputClass} tabular-nums`} {...inv("hold_minutes")} />
        </Field>
      </Section>

      <Section title="Reminders and booking">
        <Field name="reminder_days_before" label="Remind days before follow-up" errors={errors}>
          <input id="reminder_days_before" name="reminder_days_before" type="text" inputMode="numeric" defaultValue={values.reminder_days_before} className={`${inputClass} tabular-nums`} {...inv("reminder_days_before")} />
        </Field>
        <Field name="reminder_send_hour" label="Reminder hour (0 to 23, Dhaka time)" errors={errors}>
          <input id="reminder_send_hour" name="reminder_send_hour" type="text" inputMode="numeric" defaultValue={values.reminder_send_hour} className={`${inputClass} tabular-nums`} {...inv("reminder_send_hour")} />
        </Field>
        <label className="flex items-start gap-3 rounded-md border border-neutral-200 p-3 sm:col-span-2">
          <input type="checkbox" name="booking_open" defaultChecked={values.booking_open !== "false"} className="mt-1 h-5 w-5 accent-accent" />
          <span>
            <span className="block text-base font-medium text-neutral-900">Online booking open</span>
            <span className="block text-sm text-neutral-600">
              When off, the public booking link shows a closed message. Follow-up links keep working.
            </span>
          </span>
        </label>
      </Section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.savedAt ? (
          <span className="text-sm text-neutral-600" aria-live="polite">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  );
}
