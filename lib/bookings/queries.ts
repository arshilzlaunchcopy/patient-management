import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import { listPatients } from "@/lib/patients/queries";
import type { AppointmentStatus, PatientStatus, VisitMode } from "@/lib/types";

export interface ClaimPatient {
  id: string;
  name: string;
  phone: string;
  status: PatientStatus;
  serial_no: string | null;
}

export interface ClaimRow {
  id: string;
  claimed_name: string;
  trx_id: string | null;
  sender_phone: string | null;
  amount: number | null;
  created_at: string;
  appointment: {
    id: string;
    scheduled_date: string;
    queue_no: number | null;
    mode: VisitMode;
    status: AppointmentStatus;
    fee_amount: number | null;
    booking_source: string;
    patient: ClaimPatient;
  };
}

/** Submitted claims, oldest first: the doctor clears them top to bottom. */
export async function listClaims(): Promise<ClaimRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("payment_claims")
    .select(
      "id, claimed_name, trx_id, sender_phone, amount, created_at, appointments(id, scheduled_date, queue_no, mode, status, fee_amount, booking_source, patients(id, name, phone, status, serial_no))",
    )
    .eq("status", "submitted")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listClaims: ${error.message}`);

  type Raw = Omit<ClaimRow, "appointment"> & {
    appointments: (Omit<ClaimRow["appointment"], "patient"> & { patients: ClaimPatient | null }) | null;
  };
  return ((data ?? []) as unknown as Raw[])
    .filter((r) => r.appointments?.patients)
    .map(({ appointments, ...r }) => {
      const { patients, ...appt } = appointments!;
      return { ...r, appointment: { ...appt, patient: patients! } };
    });
}

export interface PendingPatient {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  appointments: { id: string; scheduled_date: string; status: AppointmentStatus; queue_no: number | null }[];
}

/** Self-registered patients the doctor has not accepted yet. */
export async function listPendingPatients(): Promise<PendingPatient[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, name, phone, created_at, appointments(id, scheduled_date, status, queue_no)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listPendingPatients: ${error.message}`);
  return (data ?? []) as unknown as PendingPatient[];
}

export interface HoldRow {
  id: string;
  scheduled_date: string;
  hold_expires_at: string;
  booking_source: string;
  created_at: string;
  patient: { id: string; name: string; phone: string; status: PatientStatus };
}

/** Holds that have not expired, soonest to expire first. */
export async function listHolds(): Promise<HoldRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_date, hold_expires_at, booking_source, created_at, patients(id, name, phone, status)")
    .eq("status", "hold")
    .gt("hold_expires_at", new Date().toISOString())
    .order("hold_expires_at", { ascending: true });
  if (error) throw new Error(`listHolds: ${error.message}`);

  type Raw = Omit<HoldRow, "patient"> & { patients: HoldRow["patient"] | null };
  return ((data ?? []) as unknown as Raw[])
    .filter((r) => r.patients)
    .map(({ patients, ...r }) => ({ ...r, patient: patients! }));
}

export interface MergeCandidate {
  id: string;
  name: string;
  phone: string;
  serial_no: string | null;
}

/** Active patients matching a merge search term (name, serial, or phone in any format). */
export async function findMergeCandidates(q: string, excludeId: string): Promise<MergeCandidate[]> {
  const rows = await listPatients(q);
  return rows
    .filter((r) => r.id !== excludeId)
    .slice(0, 6)
    .map((r) => ({ id: r.id, name: r.name, phone: r.phone, serial_no: r.serial_no }));
}
