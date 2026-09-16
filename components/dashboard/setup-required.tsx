import { MIGRATIONS, type SchemaStatus } from "@/lib/supabase/schema";
import { cardClass } from "@/components/ui/styles";

const codeClass = "rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-sm";

/**
 * Shown by the dashboard layout in place of every page while the connected
 * Supabase project has no schema. The env var is read inside the component
 * so nothing touches process.env at module scope.
 */
export function SetupRequired({ status }: { status: Extract<SchemaStatus, { ok: false }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let host = "";
  let ref = "";
  try {
    host = new URL(url).host;
    ref = host.split(".")[0] ?? "";
  } catch {
    // Unset or malformed; the page still renders without the project link.
  }
  const sqlEditorUrl = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : null;
  const fromIndex = MIGRATIONS.findIndex((m) => m.file === status.migration);
  const partial = fromIndex > 0;

  return (
    <div className={`${cardClass} p-8`}>
      <p className="text-sm font-medium uppercase tracking-wide text-amber-700">Setup needed</p>
      <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
        The database is not set up yet
      </h1>
      <p className="mt-3 text-base text-neutral-700">
        {partial ? (
          <>
            <code className={codeClass}>{status.missingTable}</code> is missing or out of date, so
            migrations from <strong>{status.migration}</strong> onward have not been applied.
          </>
        ) : (
          <>
            This site is connected to a Supabase project that has no tables in it. The app cannot
            create them itself, so they are added once by pasting the SQL below into Supabase.
          </>
        )}
      </p>

      {host ? (
        <p className="mt-2 text-sm text-neutral-500">
          Connected project: <span className="font-mono text-neutral-700">{host}</span>. If that is
          not the project you set up, change <code className={codeClass}>NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          in the Netlify environment variables instead.
        </p>
      ) : null}

      <ol className="mt-6 list-decimal space-y-3 pl-6 text-base text-neutral-800">
        <li>
          Open the SQL editor for this project
          {sqlEditorUrl ? (
            <>
              {": "}
              <a
                href={sqlEditorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-strong underline"
              >
                supabase.com → SQL Editor
              </a>
            </>
          ) : (
            " (Supabase dashboard → SQL Editor)"
          )}
          .
        </li>
        <li>
          Paste the contents of <code className={codeClass}>supabase/setup.sql</code> from the
          project folder and press <strong>Run</strong>. It contains every migration in order and
          is safe to run more than once.
        </li>
        <li>
          Come back here and reload. To try the app with sample patients, open{" "}
          <strong>Settings → Demo data → Reset demo data</strong>.
        </li>
      </ol>

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-neutral-700">
          Or run the migration files one at a time
        </summary>
        <p className="mt-2 text-sm text-neutral-600">
          They live in <code className={codeClass}>supabase/migrations/</code>. Run them top to
          bottom{partial ? `, starting from ${status.migration}` : ""}.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {MIGRATIONS.map((m, i) => (
            <li key={m.file} className={i < fromIndex ? "text-neutral-400" : "text-neutral-800"}>
              <code className="font-mono">{m.file}</code>
              <span className="text-neutral-500"> · {m.what}</span>
              {i < fromIndex ? <span className="ml-2 text-xs">already applied</span> : null}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
