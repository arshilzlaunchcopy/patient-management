import "server-only";
import { createUserClient } from "@/lib/supabase/server";

export interface CampaignRow {
  id: string;
  name: string | null;
  body: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

export interface TemplateRow {
  id: string;
  key: string;
  label_en: string;
  body_bn: string;
  variables: string[];
  is_active: boolean;
}

/** Saved texts the doctor typed (no placeholders) come first, then the automatic ones. */
export async function listTemplates(): Promise<TemplateRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("sms_templates")
    .select("id, key, label_en, body_bn, variables, is_active")
    .order("label_en", { ascending: true });
  if (error) throw new Error(`listTemplates: ${error.message}`);
  return ((data ?? []) as TemplateRow[]).sort(
    (a, b) => Number(isCustomTemplate(b.key)) - Number(isCustomTemplate(a.key)),
  );
}

export function isCustomTemplate(key: string): boolean {
  return key.startsWith("custom_");
}

export const CAMPAIGN_LIMIT = 20;

/** Most recent bulk sends, newest first. */
export async function listCampaigns(): Promise<CampaignRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("sms_campaigns")
    .select("id, name, body, recipient_count, sent_count, failed_count, created_at")
    .order("created_at", { ascending: false })
    .limit(CAMPAIGN_LIMIT);
  if (error) throw new Error(`listCampaigns: ${error.message}`);
  return (data ?? []) as CampaignRow[];
}
