"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { sendFollowupReminder } from "./send";
import { todayDhaka } from "@/lib/dates";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dashboard demo button: queue the follow-up reminder for a patient whose
 * latest visit has an upcoming next_visit_date. Stands in for the cron job.
 */
export async function sendFollowupLinkAction(formData: FormData) {
  const patientId = String(formData.get("patient_id") ?? "");
  if (!UUID_RE.test(patientId)) redirect("/patients");

  // The signed-in doctor must be able to see this patient (RLS).
  const user = await createUserClient();
  const { data: patient } = await user
    .from("patients")
    .select("id, phone")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) redirect("/patients");

  const { data: latest } = await user
    .from("visits")
    .select("next_visit_date")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const date = latest?.next_visit_date as string | null | undefined;
  if (!date || date < todayDhaka()) {
    redirect(`/patients/${patientId}?followup=none`);
  }

  await sendFollowupReminder(createServiceClient(), {
    patientId,
    phone: patient.phone as string,
    date,
  });

  revalidatePath("/outbox");
  redirect(`/patients/${patientId}?followup=sent`);
}
