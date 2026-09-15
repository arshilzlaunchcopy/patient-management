import { normalizeBD } from "@/lib/phone";
import { isIsoDate } from "@/lib/dates";
import { DIABETES_TYPES, SEX_OPTIONS, type Patient } from "@/lib/types";

/** The columns the doctor edits through the profile form. */
export type PatientInput = Pick<
  Patient,
  | "name"
  | "phone"
  | "alt_phone"
  | "sex"
  | "date_of_birth"
  | "age_years"
  | "address"
  | "diabetes_type"
  | "diagnosed_on"
  | "comorbidities"
  | "allergies"
  | "notes"
>;

export type FieldErrors = Partial<Record<keyof PatientInput, string>>;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string): string | null {
  const v = text(formData, key);
  return v === "" ? null : v;
}

function optionalDate(
  formData: FormData,
  key: keyof PatientInput,
  errors: FieldErrors,
): string | null {
  const v = optional(formData, key);
  if (v !== null && !isIsoDate(v)) errors[key] = "Enter a valid date.";
  return v;
}

/**
 * Parse and validate the patient form. Returns the normalised values and
 * any field errors; the caller decides what to do with them.
 */
export function parsePatientForm(formData: FormData): {
  values: PatientInput;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};

  const name = text(formData, "name");
  if (!name) errors.name = "Name is required.";
  else if (name.length > 120) errors.name = "Name is too long.";

  const rawPhone = text(formData, "phone");
  const phone = normalizeBD(rawPhone);
  if (!rawPhone) errors.phone = "Phone number is required.";
  else if (!phone) errors.phone = "Enter a valid Bangladeshi mobile number.";

  const rawAlt = optional(formData, "alt_phone");
  const alt_phone = rawAlt === null ? null : normalizeBD(rawAlt);
  if (rawAlt !== null && !alt_phone) {
    errors.alt_phone = "Enter a valid Bangladeshi mobile number.";
  }

  const sexRaw = optional(formData, "sex");
  const sex = SEX_OPTIONS.find((s) => s === sexRaw) ?? null;
  if (sexRaw !== null && !sex) errors.sex = "Choose a valid option.";

  const typeRaw = optional(formData, "diabetes_type");
  const diabetes_type = DIABETES_TYPES.find((t) => t === typeRaw) ?? null;
  if (typeRaw !== null && !diabetes_type) {
    errors.diabetes_type = "Choose a valid option.";
  }

  const ageRaw = optional(formData, "age_years");
  let age_years: number | null = null;
  if (ageRaw !== null) {
    const n = Number(ageRaw);
    if (!Number.isInteger(n) || n < 0 || n > 120) {
      errors.age_years = "Enter an age between 0 and 120.";
    } else {
      age_years = n;
    }
  }

  const date_of_birth = optionalDate(formData, "date_of_birth", errors);
  const diagnosed_on = optionalDate(formData, "diagnosed_on", errors);

  return {
    values: {
      name,
      phone: phone ?? rawPhone,
      alt_phone,
      sex,
      date_of_birth,
      age_years,
      address: optional(formData, "address"),
      diabetes_type,
      diagnosed_on,
      comorbidities: optional(formData, "comorbidities"),
      allergies: optional(formData, "allergies"),
      notes: optional(formData, "notes"),
    },
    errors,
  };
}
