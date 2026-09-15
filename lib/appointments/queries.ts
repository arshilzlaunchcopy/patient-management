import "server-only";
import { createUserClient } from "@/lib/supabase/server";
import type { Appointment } from "@/lib/types";

export async function getAppointment(id: string): Promise<Appointment | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAppointment: ${error.message}`);
  return (data as Appointment | null) ?? null;
}
