import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { checkSchema } from "@/lib/supabase/schema";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SetupRequired } from "@/components/dashboard/setup-required";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createUserClient();

  // Verifies the session JWT's signature and expiry locally (no round trip to
  // the auth server on projects with asymmetric keys). Middleware already
  // gates this; the layout is the last line of defence.
  const { data: session } = await supabase.auth.getClaims();
  if (!session) {
    redirect("/login");
  }
  const email = typeof session.claims.email === "string" ? session.claims.email : "";

  const [{ count }, schema] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
    checkSchema(supabase),
  ]);

  return (
    <div className="min-h-screen bg-neutral-50 md:flex">
      <Sidebar email={email} pendingReviewCount={count ?? 0} />
      <main className="flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">
          {/* Without the schema every page throws; show instructions once, here, instead. */}
          {schema.ok ? children : <SetupRequired status={schema} />}
        </div>
      </main>
    </div>
  );
}
