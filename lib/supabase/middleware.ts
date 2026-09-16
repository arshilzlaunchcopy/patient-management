import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes that do not require the doctor to be signed in.
 * /b and /f are the patient-facing booking flows (later phases).
 * /api holds the public booking route handlers; dashboard-only
 * route handlers must check auth themselves.
 */
const PUBLIC_PREFIXES = ["/login", "/b", "/f", "/api"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the Supabase session cookie on every request and gates the
 * dashboard. Standard @supabase/ssr pattern: the client writes refreshed
 * cookies onto both the request (for this render) and the response
 * (for the browser).
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Patient pages and public route handlers never need a session. Skip the
  // Supabase round-trip so they stay fast on slow connections. /login is the
  // one public path that still checks, to bounce a signed-in doctor home.
  if (isPublicPath(pathname) && pathname !== "/login") {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims() verifies the JWT signature and expiry (locally with the
  // project's public key, or via the auth server on legacy secret-key
  // projects), refreshing the session first if it has expired. Never trust
  // getSession() here: it does not verify anything.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims ? claims.claims : null;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
