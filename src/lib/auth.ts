import { createClient } from "@/lib/supabase/server";

export interface CurrentContext {
  /** Logged-in user's email, or null for anonymous visitors. */
  email: string | null;
  /** Org slug to render: the user's own org, or the public "demo". */
  orgSlug: string;
  /** True when viewing the public demo (not signed in). */
  isDemo: boolean;
  /** False until the signed-in user has completed the onboarding form. */
  onboarded: boolean;
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
    return { email: null, orgSlug: "demo", isDemo: true, onboarded: true };
  }

  // Accept any pending team invites for this user's email (joins their
  // employer's workspace instead of creating a new one).
  await supabase.rpc("accept_pending_invites");

  // Find an existing membership/org for this user.
  const { data: membership } = await supabase
    .from("memberships")
    .select("organizations(slug, onboarded)")
    .limit(1)
    .maybeSingle();

  type OrgRow = { slug?: string; onboarded?: boolean };
  let slug = (membership?.organizations as OrgRow | null)?.slug;
  let onboarded = (membership?.organizations as OrgRow | null)?.onboarded ?? false;

  // First login → create their workspace.
  if (!slug) {
    const defaultName = user.email?.split("@")[0]
      ? `${user.email.split("@")[0]}'s workspace`
      : "My workspace";
    await supabase.rpc("create_organization", { org_name: defaultName });
    const { data: created } = await supabase
      .from("memberships")
      .select("organizations(slug, onboarded)")
      .limit(1)
      .maybeSingle();
    slug = (created?.organizations as OrgRow | null)?.slug;
    onboarded = (created?.organizations as OrgRow | null)?.onboarded ?? false;
  }

  return {
    email: user.email ?? null,
    orgSlug: slug ?? "demo",
    isDemo: !slug,
    onboarded,
  };
}
