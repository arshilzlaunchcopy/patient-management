/**
 * Row types mirroring supabase/migrations. Hand-written on purpose: the
 * schema is small and generated types would add a build step.
 */

export const SEX_OPTIONS = ["M", "F", "Other"] as const;
export type Sex = (typeof SEX_OPTIONS)[number];

export const DIABETES_TYPES = [
  "Type 1",
  "Type 2",
  "Gestational",
  "Pre-diabetic",
  "Other",
] as const;
export type DiabetesType = (typeof DIABETES_TYPES)[number];

export type PatientStatus = "active" | "pending" | "inactive";
export type PatientSource = "walk_in" | "online_booking";

export interface Patient {
  id: string;
  serial_no: string | null;
  name: string;
  phone: string;
  alt_phone: string | null;
  sex: Sex | null;
  date_of_birth: string | null;
  age_years: number | null;
  address: string | null;
  diabetes_type: DiabetesType | null;
  diagnosed_on: string | null;
  comorbidities: string | null;
  allergies: string | null;
  notes: string | null;
  status: PatientStatus;
  source: PatientSource;
  created_at: string;
  updated_at: string;
}

export const VISIT_MODES = ["in_person", "video"] as const;
export type VisitMode = (typeof VISIT_MODES)[number];

export const PAYMENT_METHODS = ["cash", "bkash", "free"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type AppointmentStatus =
  | "hold"
  | "pending_review"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show"
  | "expired";

export interface Appointment {
  id: string;
  patient_id: string;
  scheduled_date: string;
  queue_no: number | null;
  mode: VisitMode;
  status: AppointmentStatus;
  booking_source: "doctor" | "open_link" | "followup_link";
  fee_amount: number | null;
  hold_expires_at: string | null;
  reminder_sent_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ConsultDay {
  id: string;
  date: string;
  mode: VisitMode;
  call_start: string;
  call_end: string;
  capacity: number | null;
  is_open_for_new: boolean;
  is_cancelled: boolean;
  note: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  visit_date: string;
  mode: string;
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
  payment_method: "cash" | "bkash" | "free" | null;
  next_visit_date: string | null;
  created_at: string;
}
