// Public Supabase connection values. These are NOT secrets — the project URL
// and publishable (anon) key are designed to be shipped to the browser and are
// protected by Row-Level Security. Env vars take precedence; the fallbacks keep
// the app working (demo workspace) even if they aren't configured on the host.
//
// Note: an unset NEXT_PUBLIC_* var is inlined as an empty string, not
// undefined, so `??` would not trigger — use a truthiness check instead.
const envOr = (value: string | undefined, fallback: string) =>
  value && value.length > 0 ? value : fallback;

export const SUPABASE_URL = envOr(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "https://ttjzmmqalbfeybysmqko.supabase.co",
);

export const SUPABASE_ANON_KEY = envOr(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "sb_publishable_LztXbrEa4Evw12Iehs4H5A_ivQU-ZOz",
);
