"use client";

import { useActionState } from "react";
import { refreshDeliveryAction, type RefreshDeliveryState } from "@/lib/sms/actions";
import { buttonSecondaryClass } from "@/components/ui/styles";
import { Spinner } from "@/components/ui/spinner";

/**
 * "Check delivery" button: asks the gateway what became of recently sent
 * messages. With a patientId, only that patient's messages.
 */
export function CheckDelivery({
  patientId,
  compact = false,
}: {
  patientId?: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<RefreshDeliveryState, FormData>(
    refreshDeliveryAction,
    {},
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      {patientId ? <input type="hidden" name="patient_id" value={patientId} /> : null}
      <button
        type="submit"
        disabled={pending}
        className={`${buttonSecondaryClass} ${compact ? "px-3 py-1.5 text-sm" : ""}`}
      >
        {pending ? (
          <>
            <Spinner className="mr-2" />
            Checking…
          </>
        ) : (
          "Check delivery"
        )}
      </button>
      {state.message ? (
        <span className="text-sm text-neutral-700" aria-live="polite">
          {state.message}
        </span>
      ) : null}
      {state.error ? (
        <span className="text-sm text-red-700" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
