import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { DashboardChrome } from "@/components/dashboard-chrome";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentContext();

  if (!ctx.isDemo && !ctx.onboarded) {
    redirect("/onboarding");
  }

  const db = ctx.isDemo ? createPublicClient() : await createClient();
  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();
  const workspaceName = org?.name ?? "Workspace";

  return (
    <DashboardChrome workspaceName={workspaceName} email={ctx.email}>
      {children}
    </DashboardChrome>
  );
}
