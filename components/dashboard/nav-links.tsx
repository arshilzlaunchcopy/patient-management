"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(dashboard)/actions";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/patients", label: "Patients" },
  { href: "/schedule", label: "Schedule" },
  { href: "/bookings", label: "Bookings" },
  { href: "/outbox", label: "Outbox" },
  { href: "/messages", label: "Messages" },
  { href: "/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavLinks({
  pendingReviewCount,
}: {
  pendingReviewCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3 md:pb-0"
    >
      {NAV.map(({ href, label }) => {
        const active = isActive(pathname, href);
        const badge = href === "/bookings" && pendingReviewCount > 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2.5 text-base",
              active
                ? "bg-accent-soft font-medium text-accent-strong"
                : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
            ].join(" ")}
          >
            <span>{label}</span>
            {badge ? (
              <span
                aria-label={`${pendingReviewCount} awaiting verification`}
                className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white"
              >
                {pendingReviewCount}
              </span>
            ) : null}
          </Link>
        );
      })}

      {/* Sign out lives in the nav row on small screens, in the sidebar footer on desktop. */}
      <form action={signOut} className="ml-auto shrink-0 md:hidden">
        <button
          type="submit"
          className="rounded-md px-3 py-2.5 text-base text-neutral-700 hover:bg-neutral-100"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
