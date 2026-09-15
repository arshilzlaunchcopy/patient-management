"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { parsePatientForm, type FieldErrors } from "./validation";

export interface PatientFormState {
  /** Field-level validation messages. */
  errors?: FieldErrors;
  /** A general failure message (database error etc.). */
  message?: string;
  /** Set when the phone number already belongs to another patient. */
  conflict?: { id: string; name: string; serial_no: string | null };
}

async function findByPhone(
  supabase: Awaited<ReturnType<typeof createUserClient>>,
  phone: string,
  excludeId?: string,
) {
  let q = supabase
    .from("patients")
    .select("id, name, serial_no")
    .eq("phone", phone);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; name: string; serial_no: string | null } | null;
}

export async function createPatient(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const { values, errors } = parsePatientForm(formData);
  if (Object.keys(errors).length) return { errors };

  const supabase = await createUserClient();

  const existing = await findByPhone(supabase, values.phone);
  if (existing) return { conflict: existing };

  const { data: serial, error: serialError } = await supabase.rpc(
    "next_patient_serial",
  );
  if (serialError || typeof serial !== "string") {
    return {
      message:
        "Could not allocate a serial number. Has migration 002 been applied?",
    };
  }

  const { data, error } = await supabase
    .from("patients")
    .insert({
      ...values,
      serial_no: serial,
      status: "active",
      source: "walk_in",
    })
    .select("id")
    .single();

  if (error) {
    // Unique violation on phone: someone registered this number a moment ago.
    if (error.code === "23505") {
      const again = await findByPhone(supabase, values.phone);
      if (again) return { conflict: again };
    }
    return { message: `Could not save patient: ${error.message}` };
  }

  revalidatePath("/patients");
  redirect(`/patients/${data.id}`);
}

export async function updatePatient(
  id: string,
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const { values, errors } = parsePatientForm(formData);
  if (Object.keys(errors).length) return { errors };

  const supabase = await createUserClient();

  const existing = await findByPhone(supabase, values.phone, id);
  if (existing) return { conflict: existing };

  const { error } = await supabase.from("patients").update(values).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      const again = await findByPhone(supabase, values.phone, id);
      if (again) return { conflict: again };
    }
    return { message: `Could not save changes: ${error.message}` };
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);
  redirect(`/patients/${id}`);
}
