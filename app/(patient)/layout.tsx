import type { Metadata } from "next";
import { Noto_Sans_Bengali } from "next/font/google";
import { createServiceClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { displayBD, waLink } from "@/lib/phone";
import { bn } from "@/lib/i18n/bn";

/**
 * Self-hosted at build time by next/font, so patients never fetch from
 * Google and rendering no longer depends on which Bangla font (if any)
 * their Android version ships.
 */
const bengali = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // absolute: do not apply the dashboard's "· Clinic Management" template.
  title: { absolute: bn.header },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Shell for every patient-facing page (/b and /f). Bangla, 18px base,
 * single column, no navigation. The dashboard never renders inside this.
 * Clinic details come from settings through the service client, because
 * a patient has no session and row-level security would return nothing.
 */
export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings(
    ["doctor_name_bn", "clinic_name_bn", "whatsapp_number"] as const,
    createServiceClient(),
  );
  const doctor = s.doctor_name_bn?.trim() || bn.doctorName;
  const clinic = s.clinic_name_bn?.trim() || "";
  // The seed ships a placeholder number full of X; never show that.
  const whatsapp = s.whatsapp_number && !/x/i.test(s.whatsapp_number) ? s.whatsapp_number : null;
  const wa = whatsapp ? waLink(whatsapp) : null;

  return (
    <div
      lang="bn"
      className={`${bengali.className} flex min-h-screen flex-col bg-neutral-50 text-lg leading-relaxed text-neutral-900`}
    >
      <header className="bg-accent text-white">
        <div className="mx-auto max-w-md px-4 py-5">
          <p className="text-2xl font-bold leading-snug">{doctor}</p>
          <p className="mt-0.5 text-base text-white/85">{clinic || bn.clinicSubtitle}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-md px-4 py-5 text-base text-neutral-600">
          <p className="font-semibold text-neutral-800">{doctor}</p>
          {clinic ? <p>{clinic}</p> : null}
          {whatsapp ? (
            <p className="mt-2">
              {bn.footerWhatsApp}:{" "}
              {wa ? (
                <a href={wa} className="font-semibold tabular-nums text-accent-strong underline">
                  {displayBD(whatsapp)}
                </a>
              ) : (
                <span className="font-semibold tabular-nums">{displayBD(whatsapp)}</span>
              )}
              <span className="block text-sm text-neutral-500">{bn.footerHelp}</span>
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
