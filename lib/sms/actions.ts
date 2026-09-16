"use server";

import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/supabase/server";
import { deliverQueued } from "./provider";

export interface SendQueuedState {
  message?: string;
  error?: string;
}

/** Outbox button: push queued messages through the gateway. Doctor only. */
export async function sendQueuedAction(): Promise<SendQueuedState> {
  const supabase = await createUserClient();
  const { data: session } = await supabase.auth.getClaims();
  if (!session) return { error: "Sign in again." };

  try {
    const r = await deliverQueued(100);
    revalidatePath("/outbox");
    if (r.sent === 0 && r.failed === 0) {
      return { message: "Nothing was sent. Is SMS_API_KEY set on the site?" };
    }
    return {
      message: `Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}${
        r.remaining ? `, ${r.remaining} still queued (press again)` : ""
      }.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send." };
  }
}
