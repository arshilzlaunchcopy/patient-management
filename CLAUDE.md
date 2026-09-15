# CLAUDE.md

Patient management system for Dr. Khaled Nur Zihad (ডাঃ খালেদ নূর জিহাদ), a diabetology practice in Pabna, Bangladesh.

Full design spec is in `docs/SPEC.md`. Read it before starting any task.

## Stack

Next.js 15 (App Router), TypeScript, Tailwind, Supabase (Postgres + Auth), deployed to Netlify at `https://dr-khalednur.netlify.app`.

## Hard rules

These exist so that anything working locally works identically once deployed. Do not deviate without asking.

**Nothing local-machine-specific.** No absolute paths, no `~`, no OS-specific shell commands, no tooling that only exists on this machine. Anything you write must run unchanged on Netlify's build image.

**No filesystem at runtime.** Serverless functions have an ephemeral filesystem — anything written there vanishes. Never read or write local files at runtime. All persistence goes to Supabase. Any file upload goes to Supabase Storage, never to disk.

**No local-only services.** No SQLite, no local Postgres, no Redis, no local mail server, no Docker. Supabase is the only database. If something needs storage or state, it goes there.

**Environment variables are read lazily, never at module scope.** Create Supabase clients inside functions. A top-level `process.env` read crashes the build wherever that variable isn't set.

**Never hardcode `localhost`.** Use `process.env.NEXT_PUBLIC_APP_URL` for anything building a URL — payment links, follow-up links, redirects. Hardcoding localhost means every link mailed to a patient points at a machine they can't reach.

**Environment variables.** A `.env.local` exists in the project root holding real credentials. Never print it, echo it, commit it, or modify it. Read values only through `process.env`, always lazily inside functions — never at module scope, or the build breaks wherever a variable isn't set. Test locally with `npm run dev`.

**No long-running processes.** No background workers, no polling loops, no websocket servers, no in-memory caches that assume a persistent process. Serverless functions start cold and die. Scheduled work goes in `netlify/functions/` as a Netlify Scheduled Function — not in `app/api/`, which is deprecated for this on Netlify's Next.js runtime v5.

**Prefer boring and standard.** Framework defaults over clever configuration. Server components over client components unless interactivity demands it. Fewer dependencies. This has to be maintainable by someone who isn't a full-time developer.

**Never run git commands.** No `git add`, no `git commit`, no `git push`, no branching, no `git reset`. Version control is handled manually through GitHub Desktop. Leave your changes uncommitted in the working tree so they can be reviewed there. Reading state with `git status` or `git diff` is fine; changing it is not. When a phase is finished, say so and summarise what changed in one or two sentences suitable for a commit message — do not commit it yourself.

## Database changes

Write migrations as SQL files in `supabase/migrations/`, numbered in order. They are applied by pasting into the Supabase SQL editor in a browser — there are no local database credentials, so never write a Node script that connects to Supabase directly.

## Conventions

**Phone numbers.** Stored canonical as `8801XXXXXXXXX`, displayed as `01XXXXXXXXX`. Always use `lib/phone.ts`. Never parse a phone number inline.

**Language.** The doctor's dashboard and all clinical records are in English. Every patient-facing page and SMS is in Bangla, with all strings in `lib/i18n/bn.ts` — never inlined in components. Patients are never addressed by name; always `প্রিয় রোগী`.

**Timezone.** Asia/Dhaka, UTC+6, no DST. Never compare dates against server local time.

**Security.** The service role key is server-side only and must never be importable from a client component. Patient-facing pages never query Supabase from the browser — everything goes through route handlers.

**Patient-facing design.** Older users, cheap Android phones, slow connections. Large tap targets, text at 16px minimum, minimal JavaScript, no animations. Test at 360px width.

## Workflow

Work through one phase at a time. Within a phase:

1. Write the code
2. Test it with `npm run dev`
3. Run `npm run build` and fix anything it surfaces
4. Stop, report that the phase is done, and give a one-line commit message

Do not go past step 4. Committing and pushing happen manually in GitHub Desktop, and the live deploy is triggered by that push. Netlify's free tier allows 300 build minutes a month at 2–3 minutes per build, so a phase should reach the live site once, not repeatedly.

Don't start work outside the current phase's scope. If something later in the spec seems necessary now, say so rather than building ahead.
