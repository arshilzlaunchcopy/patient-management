import Link from "next/link";
import { bn } from "@/lib/i18n/bn";
import { bigButtonClass, Notice } from "@/components/patient/shell";

export default function PatientNotFound() {
  return (
    <>
      <Notice tone="error">{bn.notFoundHeading}</Notice>
      <Link href="/b" className={`${bigButtonClass} mt-6`}>
        {bn.goToBooking}
      </Link>
    </>
  );
}
