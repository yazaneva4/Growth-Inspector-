import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/auth";
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

  return (
    <DashboardChrome workspaceName={ctx.orgName ?? "Workspace"} email={ctx.email}>
      {children}
    </DashboardChrome>
  );
}
