import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendFollowupReminder } from "@/lib/followup/send";
import { normalizeBD } from "@/lib/phone";

const MAX_PER_HOUR = 3;

/**
 * Flow B fallback. Always answers the same way, so nothing leaks about
 * which numbers are registered. Never creates a patient.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const phone = normalizeBD(String(form.get("phone") ?? ""));

  // A malformed number is the one thing we do say, since it reveals nothing.
  if (!phone) {
    return NextResponse.redirect(new URL("/f?error=phone", request.url), 303);
  }

  const done = NextResponse.redirect(new URL("/f?sent=1", request.url), 303);

  try {
    const supabase = createServiceClient();

    // Rate limit: three attempts per number per hour, then ignore silently.
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await supabase
      .from("followup_requests")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_HOUR) return done;
    await supabase.from("followup_requests").insert({ phone });

    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("phone", phone)
      .neq("status", "inactive")
      .maybeSingle();
    if (!patient) return done;

    const { data: latest } = await supabase
      .from("patient_latest_visits")
      .select("next_visit_date")
      .eq("patient_id", patient.id)
      .maybeSingle();
    // An overdue date still gets a link: it opens on the new-day chooser.
    const date = latest?.next_visit_date as string | null | undefined;
    if (!date) return done;

    await sendFollowupReminder(supabase, { patientId: patient.id as string, phone, date });
  } catch (err) {
    // Still the same response: the patient learns nothing from a failure.
    console.error("followup/request:", err);
  }

  return done;
}
