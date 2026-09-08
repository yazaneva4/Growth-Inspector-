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
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component — the proxy refreshes the session
        }
      },
    },
  });
}

/**
 * Trusted server-side client for webhook/background work.
 * Prefer the modern Supabase secret key, then the legacy service-role key.
 * Never expose either key to browser code.
 */
export function createServiceClient() {
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = secret || serviceRole;
  if (!key) throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for trusted server operations.");
  return createSupabaseClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

/** Anonymous (publishable-key) client for public server-side reads. */
export function createPublicClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}
