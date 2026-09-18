import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "@/lib/supabase/server";
import { buildPatientsCsv } from "@/lib/patients/export";
import { todayDhaka } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * GET /patients/export[?filter=…&q=…] → patients-YYYY-MM-DD.csv
 * Lives inside the dashboard group so middleware gates it, and checks the
 * session again itself. Reads through the doctor's client, so RLS applies.
 */
export async function GET(request: NextRequest) {
  const supabase = await createUserClient();
  const { data: session } = await supabase.auth.getClaims();
  if (!session) return new NextResponse("Sign in first.", { status: 401 });

  const sp = request.nextUrl.searchParams;
  const { csv } = await buildPatientsCsv(supabase, {
    filter: sp.get("filter") ?? undefined,
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="patients-${todayDhaka()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
