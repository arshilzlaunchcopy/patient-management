import { isIsoDate } from "@/lib/dates";
import {
  PAYMENT_METHODS,
  VISIT_MODES,
  type PaymentMethod,
  type VisitMode,
} from "@/lib/types";

export interface VisitInput {
  visit_date: string;
  mode: VisitMode;
  weight_kg: number | null;
  height_cm: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  fbs: number | null;
  rbs: number | null;
  hba1c: number | null;
  creatinine: number | null;
  complaints: string | null;
  examination: string | null;
  diagnosis: string | null;
  prescription: string | null;
  advice: string | null;
  fee_charged: number | null;
  payment_method: PaymentMethod | null;
  next_visit_date: string | null;
}

export type VisitFieldErrors = Partial<Record<keyof VisitInput, string>>;

const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "৭.৫" → "7.5", "72,5" → "72.5". */
function asciiNumber(s: string): string {
  let out = "";
  for (const ch of s) {
    const bn = BENGALI_DIGITS.indexOf(ch);
    out += bn === -1 ? (ch === "," ? "." : ch) : String(bn);
  }
  return out.trim();
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string): string | null {
  const v = text(formData, key);
  return v === "" ? null : v;
}

interface NumRule {
  min: number;
  max: number;
  integer?: boolean;
  label: string;
}

const NUM_RULES: Record<
  | "weight_kg"
  | "height_cm"
  | "bp_systolic"
  | "bp_diastolic"
  | "fbs"
  | "rbs"
  | "hba1c"
  | "creatinine"
  | "fee_charged",
  NumRule
> = {
  weight_kg: { min: 10, max: 300, label: "Weight" },
  height_cm: { min: 50, max: 250, label: "Height" },
  bp_systolic: { min: 50, max: 300, integer: true, label: "Systolic" },
  bp_diastolic: { min: 30, max: 200, integer: true, label: "Diastolic" },
  fbs: { min: 1, max: 60, label: "Fasting sugar" },
  rbs: { min: 1, max: 60, label: "Random sugar" },
  hba1c: { min: 3, max: 20, label: "HbA1c" },
  creatinine: { min: 0.1, max: 30, label: "Creatinine" },
  fee_charged: { min: 0, max: 100000, label: "Fee" },
};

function optionalNumber(
  formData: FormData,
  key: keyof typeof NUM_RULES,
  errors: VisitFieldErrors,
): number | null {
  const raw = text(formData, key);
  if (raw === "") return null;
  const rule = NUM_RULES[key];
  const n = Number(asciiNumber(raw));
  if (!Number.isFinite(n)) {
    errors[key] = `${rule.label} must be a number.`;
    return null;
  }
  if (rule.integer && !Number.isInteger(n)) {
    errors[key] = `${rule.label} must be a whole number.`;
    return null;
  }
  if (n < rule.min || n > rule.max) {
    errors[key] = `${rule.label} must be between ${rule.min} and ${rule.max}.`;
    return null;
  }
  return n;
}

export function parseVisitForm(formData: FormData): {
  values: VisitInput;
  errors: VisitFieldErrors;
} {
  const errors: VisitFieldErrors = {};

  const visit_date = text(formData, "visit_date");
  if (!isIsoDate(visit_date)) errors.visit_date = "Enter a valid date.";

  const modeRaw = text(formData, "mode");
  const mode = VISIT_MODES.find((m) => m === modeRaw) ?? "in_person";
  if (modeRaw && !VISIT_MODES.includes(modeRaw as VisitMode)) {
    errors.mode = "Choose a valid mode.";
  }

  const bp_systolic = optionalNumber(formData, "bp_systolic", errors);
  const bp_diastolic = optionalNumber(formData, "bp_diastolic", errors);
  if (bp_systolic !== null && bp_diastolic === null && !errors.bp_diastolic) {
    errors.bp_diastolic = "Enter the diastolic value too.";
  }
  if (bp_diastolic !== null && bp_systolic === null && !errors.bp_systolic) {
    errors.bp_systolic = "Enter the systolic value too.";
  }
  if (
    bp_systolic !== null &&
    bp_diastolic !== null &&
    bp_diastolic >= bp_systolic
  ) {
    errors.bp_diastolic = "Diastolic must be lower than systolic.";
  }

  const payRaw = optionalText(formData, "payment_method");
  const payment_method = PAYMENT_METHODS.find((p) => p === payRaw) ?? null;
  if (payRaw !== null && !payment_method) {
    errors.payment_method = "Choose a valid option.";
  }

  const next_visit_date = optionalText(formData, "next_visit_date");
  if (next_visit_date !== null && !isIsoDate(next_visit_date)) {
    errors.next_visit_date = "Enter a valid date.";
  } else if (
    next_visit_date !== null &&
    !errors.visit_date &&
    next_visit_date <= visit_date
  ) {
    errors.next_visit_date = "Next visit must be after the visit date.";
  }

  return {
    values: {
      visit_date,
      mode,
      weight_kg: optionalNumber(formData, "weight_kg", errors),
      height_cm: optionalNumber(formData, "height_cm", errors),
      bp_systolic,
      bp_diastolic,
      fbs: optionalNumber(formData, "fbs", errors),
      rbs: optionalNumber(formData, "rbs", errors),
      hba1c: optionalNumber(formData, "hba1c", errors),
      creatinine: optionalNumber(formData, "creatinine", errors),
      complaints: optionalText(formData, "complaints"),
      examination: optionalText(formData, "examination"),
      diagnosis: optionalText(formData, "diagnosis"),
      prescription: optionalText(formData, "prescription"),
      advice: optionalText(formData, "advice"),
      fee_charged: optionalNumber(formData, "fee_charged", errors),
      payment_method,
      next_visit_date,
    },
    errors,
  };
}
