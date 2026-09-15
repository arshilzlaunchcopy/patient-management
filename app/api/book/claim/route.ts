import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { markTokenUsed, resolvePaymentToken } from "@/lib/booking/tokens";
import { normalizeBD } from "@/lib/phone";

const TRX_RE = /^[A-Z0-9]{10}$/;

/**
 * Flow A, step 4 → 5. Plain form POST from /b/pay/[token]/proof.
 * Creates the payment claim, moves the appointment to pending_review,
 * clears the hold, assigns the queue number, and redirects to /b/done.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const claimedName = String(form.get("claimed_name") ?? "").trim();
  const method = String(form.get("method") ?? "trx");
  const trxRaw = String(form.get("trx_id") ?? "").trim().toUpperCase();
  const senderRaw = String(form.get("sender_phone") ?? "").trim();

  const back = (error: string) =>
    NextResponse.redirect(
      new URL(
        `/b/pay/${encodeURIComponent(token)}/proof?error=${error}&method=${method === "sender" ? "sender" : "trx"}`,
        request.url,
      ),
      303,
    );

  try {
    const supabase = createServiceClient();
    const ctx = await resolvePaymentToken(supabase, token);
    if (!ctx) return NextResponse.redirect(new URL("/b", request.url), 303);

    const { appointment } = ctx;
    if (appointment.status !== "hold") {
      return NextResponse.redirect(new URL(`/b/done?t=${token}`, request.url), 303);
    }
    if (
      !appointment.hold_expires_at ||
      new Date(appointment.hold_expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.redirect(new URL(`/b/pay/${token}`, request.url), 303);
    }

    if (!claimedName || claimedName.length > 100) return back("name");

    // The chosen method is required and must be valid; the other is kept if
    // it was also filled in and valid, so both can be stored.
    const trxId = trxRaw || null;
    const senderPhone = senderRaw ? normalizeBD(senderRaw) : null;

    if (method === "sender") {
      if (!senderRaw) return back("proofRequired");
      if (!senderPhone) return back("sender");
      if (trxId && !TRX_RE.test(trxId)) return back("trx");
    } else {
      if (!trxId) return back("proofRequired");
      if (!TRX_RE.test(trxId)) return back("trx");
      if (senderRaw && !senderPhone) return back("sender");
    }

    if (trxId) {
      const { data: dup, error: dupError } = await supabase
        .from("payment_claims")
        .select("id")
        .eq("trx_id", trxId)
        .neq("status", "rejected")
        .limit(1)
        .maybeSingle();
      if (dupError) throw new Error(dupError.message);
      if (dup) return back("trxUsed");
    }

    const { error: claimError } = await supabase.from("payment_claims").insert({
      appointment_id: appointment.id,
      claimed_name: claimedName,
      trx_id: trxId,
      sender_phone: senderPhone,
      amount: appointment.fee_amount,
      status: "submitted",
    });
    if (claimError) {
      if (claimError.code === "23505") return back("trxUsed");
      throw new Error(claimError.message);
    }

    const { error: apptError } = await supabase
      .from("appointments")
      .update({ status: "pending_review", hold_expires_at: null })
      .eq("id", appointment.id)
      .eq("status", "hold");
    if (apptError) throw new Error(apptError.message);

    // A resubmission after a rejected claim keeps the serial it was told.
    if (appointment.queue_no === null) {
      const { error: queueError } = await supabase.rpc("assign_queue_no", {
        p_appt: appointment.id,
      });
      if (queueError) throw new Error(`assign_queue_no: ${queueError.message}`);
    }

    await markTokenUsed(supabase, token);

    return NextResponse.redirect(new URL(`/b/done?t=${token}`, request.url), 303);
  } catch (err) {
    console.error("book/claim:", err);
    return back("generic");
  }
}
