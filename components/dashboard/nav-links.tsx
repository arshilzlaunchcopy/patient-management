"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/patients", label: "Patients" },
  { href: "/schedule", label: "Schedule" },
  { href: "/bookings", label: "Bookings" },
  { href: "/messages", label: "Messages" },
  { href: "/outbox", label: "Outbox" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Spinner that appears on the link being navigated to while its page loads. */
function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="text-accent" /> : null;
}

/**
 * On a phone the links wrap into two rows of chips so every page is one tap
 * away without scrolling sideways; on a laptop they stack in the sidebar.
 */
export function NavLinks({
  pendingReviewCount,
}: {
  pendingReviewCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex flex-wrap gap-1.5 px-3 pb-3 md:flex-col md:gap-1 md:px-3 md:pb-0"
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
              "flex min-h-11 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[15px] transition-colors md:px-3 md:text-base",
              "border md:border-0",
              active
                ? "border-accent bg-accent-soft font-medium text-accent-strong"
                : "border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 md:border-transparent",
            ].join(" ")}
          >
            <span>{label}</span>
            <span className="flex items-center gap-2">
              <LinkPending />
              {badge ? (
                <span
                  aria-label={`${pendingReviewCount} awaiting verification`}
                  className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white"
                >
                  {pendingReviewCount}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
