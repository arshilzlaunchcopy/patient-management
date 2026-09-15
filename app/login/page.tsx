import type { Metadata } from "next";
import { signIn } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  missing: "Enter your email and password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <form
        action={signIn}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8"
      >
        <h1 className="text-xl font-semibold text-neutral-900">
          Dr. Khaled Nur Zihad
        </h1>
        <p className="mt-1 text-sm text-neutral-600">Clinic Management</p>

        <div className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-800"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1.5 block w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base text-neutral-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-neutral-800"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1.5 block w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base text-neutral-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {message ? (
            <p role="alert" className="text-sm text-red-700">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-md bg-accent px-4 py-2.5 text-base font-medium text-white hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2"
          >
            Sign in
          </button>
        </div>
      </form>
    </main>
  );
}
