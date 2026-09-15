import type { Metadata } from "next";
import { getSettings, SETTING_KEYS, type SettingKey } from "@/lib/settings";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { ResetDemo } from "@/components/settings/reset-demo";
import { ShareLinks } from "@/components/dashboard/share-links";
import { displayBD } from "@/lib/phone";

export const metadata: Metadata = { title: "Settings" };

const DEFAULTS: Record<SettingKey, string> = {
  doctor_name_en: "Dr. Khaled Nur Zihad",
  doctor_name_bn: "ডাঃ খালেদ নূর জিহাদ",
  clinic_name_bn: "ডায়াবেটিস কেয়ার সেন্টার",
  bkash_number: "",
  whatsapp_number: "",
  video_fee: "500",
  in_person_fee: "500",
  default_call_start: "20:00",
  default_call_end: "22:00",
  default_capacity: "15",
  hold_minutes: "30",
  reminder_days_before: "2",
  reminder_send_hour: "10",
  booking_open: "true",
};

export default async function SettingsPage() {
  const stored = await getSettings(SETTING_KEYS);
  const values = { ...DEFAULTS };
  for (const k of SETTING_KEYS) {
    if (stored[k] !== null && stored[k] !== undefined) values[k] = stored[k]!;
  }
  // Placeholders from the seed are not real numbers; show them blank.
  if (/X/i.test(values.bkash_number)) values.bkash_number = "";
  if (/X/i.test(values.whatsapp_number)) values.whatsapp_number = "";
  else values.whatsapp_number = displayBD(values.whatsapp_number);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Fees, call window defaults, reminders and clinic details."
      />
      <div className="space-y-6">
        <ShareLinks />
        <SettingsForm values={values} />
        <ResetDemo />
      </div>
    </>
  );
}
