import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

/** Server-side Supabase client bound to the request's auth cookies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // called from a Server Component — the proxy refreshes the session
        }
      },
    },
  });
}

/**
 * Service-role client for trusted server contexts (webhook ingestion,
 * background jobs) that must bypass RLS. NEVER expose to the browser.
 */
export function createServiceClient() {
  return createSupabaseClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
}

/**
 * Anonymous (publishable-key) client for server-side reads that rely on RLS,
 * such as the public demo workspace dashboards. No session required.
 */
export function createPublicClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}
