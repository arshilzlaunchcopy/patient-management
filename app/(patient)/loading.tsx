import { bn } from "@/lib/i18n/bn";

export default function PatientLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="h-8 w-2/3 rounded bg-neutral-200" />
      <div className="mt-6 h-36 rounded-lg border border-neutral-200 bg-white" />
      <p className="mt-4 text-lg text-neutral-600">{bn.loading}</p>
    </div>
  );
}
