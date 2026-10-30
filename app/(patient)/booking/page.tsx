import { redirect } from "next/navigation";

/** Friendly link shared with patients; the booking flow lives at /b. */
export default function BookingLink() {
  redirect("/b");
}
