import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <>
      <PageHeader
        title="Messages"
        description="Compose and send SMS to groups of patients."
      />
      <p className="text-neutral-500">Nothing here yet.</p>
    </>
  );
}
