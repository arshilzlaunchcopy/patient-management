"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { ensureConsultDay } from "@/lib/schedule/ensure";
import { parseVisitForm, type VisitFieldErrors } from "./validation";

export interface VisitFormState {
  errors?: VisitFieldErrors;
  message?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Appointment statuses a visit is allowed to close. */
const CLOSABLE = ["scheduled", "pending_review", "hold"];

/**
 * Save a visit for `patientId`.
 *
 * Side effects, in order:
 *  1. insert the visit
 *  2. if a next visit date was set, make sure a video consult day exists for
 *     it (closed to new patients, default call window and capacity)
 *  3. mark the linked appointment completed, if there is one
 *  4. redirect to the patient page
 */
export async function createVisit(
  patientId: string,
  appointmentId: string | null,
  _prev: VisitFormState,
  formData: FormData,
): Promise<VisitFormState> {
  const { values, errors } = parseVisitForm(formData);
  if (Object.keys(errors).length) return { errors };

  const supabase = await createUserClient();

  // Resolve which appointment this visit closes, if any.
  let linkedAppointment: string | null = null;
  if (appointmentId && UUID_RE.test(appointmentId)) {
    const { data } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", appointmentId)
      .eq("patient_id", patientId)
      .in("status", CLOSABLE)
      .maybeSingle();
    linkedAppointment = data?.id ?? null;
  } else {
    // No explicit link: close a scheduled appointment on the visit date.
    const { data } = await supabase
      .from("appointments")
      .select("id")
      .eq("patient_id", patientId)
      .eq("scheduled_date", values.visit_date)
      .eq("status", "scheduled")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    linkedAppointment = data?.id ?? null;
  }

  const { error: insertError } = await supabase.from("visits").insert({
    ...values,
    patient_id: patientId,
    appointment_id: linkedAppointment,
  });
  if (insertError) {
    return { message: `Could not save visit: ${insertError.message}` };
  }

  if (values.next_visit_date) {
    // The visit is saved either way; a missing day is recoverable from /schedule.
    await ensureConsultDay(supabase, values.next_visit_date);
  }

  if (linkedAppointment) {
    await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", linkedAppointment)
      .in("status", CLOSABLE);
  }

  revalidatePath("/");
  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}
