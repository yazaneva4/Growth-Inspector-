import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase auth session so server components see a fresh token.
 * The dashboard reads the public demo workspace, so it stays viewable without
 * a login — we don't gate it here (that previously dead-ended at /login).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  // Refresh the session if present; never block the request.
  try {
    await supabase.auth.getUser();
  } catch {
    // no session / unreachable auth — fine for the public demo
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
