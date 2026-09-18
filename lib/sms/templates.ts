import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export type TemplateKey =
  | "followup_reminder"
  | "booking_confirmed"
  | "payment_not_found"
  | "chamber_reminder"
  | "day_cancelled"
  | "followup_overdue";

/**
 * Spec section 7. These are also seeded into sms_templates by migration 001;
 * the copies here are the fallback if a row is missing or inactive.
 * Nothing addresses the patient by name: always প্রিয় রোগী.
 */
export const DEFAULT_TEMPLATES: Record<
  TemplateKey,
  { label_en: string; body_bn: string; variables: string[] }
> = {
  followup_reminder: {
    label_en: "Follow-up reminder (video link)",
    body_bn:
      "প্রিয় রোগী, {{date}} তারিখে ডাঃ খালেদ নূর জিহাদ এর কাছে আপনার ফলোআপ। চেম্বারে আসুন, অথবা অনলাইনে (ভিডিও) করতে চাইলে: {{link}}",
    variables: ["date", "link"],
  },
  booking_confirmed: {
    label_en: "Booking confirmed",
    body_bn:
      "প্রিয় রোগী, পেমেন্ট নিশ্চিত হয়েছে। সিরিয়াল নং {{queue}}। {{date}} তারিখ {{start}}-{{end}} এর মধ্যে WhatsApp এ কল করা হবে।",
    variables: ["queue", "date", "start", "end"],
  },
  payment_not_found: {
    label_en: "Payment not found",
    body_bn:
      "প্রিয় রোগী, আপনার পেমেন্ট খুঁজে পাওয়া যায়নি। আবার তথ্য দিন: {{link}}",
    variables: ["link"],
  },
  chamber_reminder: {
    label_en: "Chamber appointment reminder",
    body_bn:
      "প্রিয় রোগী, {{date}} তারিখে ডাঃ খালেদ নূর জিহাদ এর চেম্বারে আপনার অ্যাপয়েন্টমেন্ট রয়েছে।",
    variables: ["date"],
  },
  day_cancelled: {
    label_en: "Consultation day cancelled",
    body_bn:
      "প্রিয় রোগী, দুঃখিত, {{date}} তারিখে ডাক্তার বসবেন না। যোগাযোগ: {{contact}}",
    variables: ["date", "contact"],
  },
  followup_overdue: {
    label_en: "Follow-up overdue (rebooking link)",
    body_bn:
      "প্রিয় রোগী, ডাঃ খালেদ নূর জিহাদ এর কাছে আপনার ফলোআপের সময় পার হয়ে গেছে। চেম্বারে আসুন, অথবা অনলাইনে (ভিডিও) করতে চাইলে দিন বেছে নিন: {{link}}",
    variables: ["link"],
  },
};

/**
 * Replace {{placeholders}} in a body. Unknown placeholders become empty and
 * are logged, so a typo in the template editor degrades a message rather
 * than breaking a booking.
 */
export function fillTemplate(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    if (key in vars) return String(vars[key]);
    console.warn(`sms template: no value for {{${key}}}`);
    return "";
  });
}

/** Load the active template body for `key`, falling back to the default. */
export async function getTemplateBody(key: TemplateKey): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sms_templates")
    .select("body_bn, is_active")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.warn(`sms template ${key}: ${error.message}; using default`);
    return DEFAULT_TEMPLATES[key].body_bn;
  }
  if (!data || !data.is_active) return DEFAULT_TEMPLATES[key].body_bn;
  return data.body_bn as string;
}

/** Load a template and fill it. */
export async function renderTemplate(
  key: TemplateKey,
  vars: Record<string, string | number>,
): Promise<string> {
  return fillTemplate(await getTemplateBody(key), vars);
}
