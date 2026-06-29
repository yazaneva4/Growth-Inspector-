import { createClient } from "@/lib/supabase/server";

export interface CurrentContext {
  /** Logged-in user's email, or null for anonymous visitors. */
  email: string | null;
  /** Org slug to render: the user's own org, or the public "demo". */
  orgSlug: string;
  /** True when viewing the public demo (not signed in). */
  isDemo: boolean;
}

/**
 * Resolve who is viewing the dashboard. If signed in, ensure they have an
 * organization (creating one on first login via the secure RPC) and return its
 * slug. Otherwise fall back to the public demo workspace.
 */
export async function getCurrentContext(): Promise<CurrentContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { email: null, orgSlug: "demo", isDemo: true };
  }

  // Find an existing membership/org for this user.
  const { data: membership } = await supabase
    .from("memberships")
    .select("organizations(slug)")
    .limit(1)
    .maybeSingle();

  let slug = (membership?.organizations as { slug?: string } | null)?.slug;

  // First login → create their workspace.
  if (!slug) {
    const defaultName = user.email?.split("@")[0]
      ? `${user.email.split("@")[0]}'s workspace`
      : "My workspace";
    await supabase.rpc("create_organization", { org_name: defaultName });
    const { data: created } = await supabase
      .from("memberships")
      .select("organizations(slug)")
      .limit(1)
      .maybeSingle();
    slug = (created?.organizations as { slug?: string } | null)?.slug;
  }

  return {
    email: user.email ?? null,
    orgSlug: slug ?? "demo",
    isDemo: !slug,
  };
}
