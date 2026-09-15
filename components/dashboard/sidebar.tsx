import { signOut } from "@/app/(dashboard)/actions";
import { NavLinks } from "./nav-links";

export function Sidebar({
  email,
  pendingReviewCount,
}: {
  email: string;
  pendingReviewCount: number;
}) {
  return (
    <aside className="border-b border-neutral-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-4 py-4 md:block md:px-6 md:py-6">
        <div>
          <p className="text-base font-semibold text-neutral-900">
            Dr. Khaled Nur Zihad
          </p>
          <p className="text-sm text-neutral-500">Clinic Management</p>
        </div>
      </div>

      <NavLinks pendingReviewCount={pendingReviewCount} />

      <div className="hidden border-t border-neutral-200 px-6 py-4 md:mt-auto md:block">
        <p className="truncate text-sm text-neutral-500" title={email}>
          {email}
        </p>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="text-sm font-medium text-neutral-700 hover:text-accent-strong"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
