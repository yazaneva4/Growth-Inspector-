import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface CurrentContext {
  email: string | null;
  name: string | null;
  userId: string | null;
  role: "owner" | "admin" | "agent" | null;
  orgSlug: string;
  orgName: string | null;
  isDemo: boolean;
  onboarded: boolean;
}

export const getCurrentContext = cache(async (): Promise<CurrentContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      email: null,
      name: null,
      userId: null,
      role: null,
      orgSlug: "demo",
      orgName: "Growth Inspector",
      isDemo: true,
      onboarded: true,
    };
  }

  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  const name = fullName || user.email?.split("@")[0] || null;

  // Always process pending team invitations for the signed-in email. A user
  // can already have an account/session (and even another workspace) when an
  // owner sends the invitation, so checking only when membership is missing
  // leaves the invite incorrectly stuck at Pending.
  await supabase.rpc("accept_pending_invites");

  type OrgRow = { slug?: string; name?: string; onboarded?: boolean };
  const { data: membership } = await supabase
    .from("memberships")
    .select("role, organizations(slug, name, onboarded)")
    .limit(1)
    .maybeSingle();

  let org = membership?.organizations as OrgRow | null;
  let slug = org?.slug;
  let orgName = org?.name ?? null;
  let onboarded = org?.onboarded ?? false;
  let role = (membership?.role as CurrentContext["role"]) ?? null;

  if (!slug) {
    const defaultName = user.email?.split("@")[0]
      ? `${user.email.split("@")[0]}'s workspace`
      : "My workspace";
    await supabase.rpc("create_organization", { org_name: defaultName });
    const { data: created } = await supabase
      .from("memberships")
      .select("role, organizations(slug, name, onboarded)")
      .limit(1)
      .maybeSingle();
    org = created?.organizations as OrgRow | null;
    slug = org?.slug;
    orgName = org?.name ?? null;
    onboarded = org?.onboarded ?? false;
    role = (created?.role as CurrentContext["role"]) ?? "owner";
  }

  return {
    email: user.email ?? null,
    name,
    userId: user.id,
    role,
    orgSlug: slug ?? "demo",
    orgName: orgName ?? "Workspace",
    isDemo: !slug,
    onboarded,
  };
});
