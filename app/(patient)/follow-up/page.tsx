import { redirect } from "next/navigation";

/** Friendly link shared with patients; the follow-up form lives at /f. */
export default function FollowUpLink() {
  redirect("/f");
}
