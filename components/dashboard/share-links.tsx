import { appUrl } from "@/lib/urls";
import { CopyButton } from "./copy-button";
import { cardClass } from "@/components/ui/styles";

const LINKS = [
  {
    path: "/b",
    label: "New patient booking",
    help: "Share anywhere. Patients pick an open date, pay by bKash and get a serial.",
  },
  {
    path: "/f",
    label: "Lost follow-up link",
    help: "For returning patients who deleted their reminder SMS. Asks for their number only.",
  },
] as const;

function safeUrl(path: string): string {
  try {
    return appUrl(path);
  } catch {
    return path; // NEXT_PUBLIC_APP_URL unset: still usable relative to this site
  }
}

const smallButton =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50";

/**
 * The two public URLs the doctor hands out, with one-tap copy, open, and
 * WhatsApp share. Shown on Today and in Settings.
 */
export function ShareLinks({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`${cardClass} ${compact ? "p-4" : "p-6"}`} aria-labelledby="share-links">
      <h2 id="share-links" className="text-base font-semibold text-neutral-900">
        Links to share with patients
      </h2>
      <ul className={`mt-3 ${compact ? "space-y-3" : "space-y-5"}`}>
        {LINKS.map((l) => {
          const url = safeUrl(l.path);
          const wa = `https://wa.me/?text=${encodeURIComponent(url)}`;
          return (
            <li key={l.path}>
              <p className="text-sm font-medium text-neutral-800">{l.label}</p>
              {!compact ? <p className="text-sm text-neutral-600">{l.help}</p> : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 basis-56 truncate rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900">
                  {url}
                </code>
                <CopyButton value={url} className={smallButton} />
                <a href={url} target="_blank" rel="noopener noreferrer" className={smallButton}>
                  Open
                </a>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${smallButton} border-accent text-accent-strong hover:bg-accent-soft`}
                >
                  Send via WhatsApp
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
