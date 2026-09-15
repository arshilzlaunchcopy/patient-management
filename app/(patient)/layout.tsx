import type { Metadata } from "next";
import { Noto_Sans_Bengali } from "next/font/google";
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
 */
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      lang="bn"
      className={`${bengali.className} min-h-screen bg-neutral-50 text-lg leading-relaxed text-neutral-900`}
    >
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-md px-4 py-4">
          <p className="text-xl font-semibold leading-snug">{bn.doctorName}</p>
          <p className="text-base text-neutral-600">অনলাইন কনসালটেশন</p>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">{children}</main>
    </div>
  );
}
