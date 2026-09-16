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
