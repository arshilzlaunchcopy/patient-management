import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already gates this, but the layout is the last line of defence.
  if (!user) {
    redirect("/login");
  }

  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review");

  return (
    <div className="min-h-screen bg-neutral-50 md:flex">
      <Sidebar email={user.email ?? ""} pendingReviewCount={count ?? 0} />
      <main className="flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
