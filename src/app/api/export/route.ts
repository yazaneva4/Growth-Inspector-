import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export the workspace's conversations as CSV. */
export async function GET() {
  const ctx = await getCurrentContext();
  const db = ctx.isDemo ? createPublicClient() : await createClient();

  const { data: org } = await db
    .from("organizations")
    .select("id, name")
    .eq("slug", ctx.orgSlug)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: "no workspace" }, { status: 404 });

  const { data } = await db
    .from("conversations")
    .select("customer_name, customer_handle, platform, intent, sentiment, language, lead_score, status, last_message_at")
    .eq("org_id", org.id)
    .order("last_message_at", { ascending: false })
    .limit(1000);

  const headers = [
    "customer",
    "handle",
    "platform",
    "intent",
    "sentiment",
    "language",
    "lead_score",
    "status",
    "last_message_at",
  ];
  const lines = [headers.join(",")];
  for (const c of data ?? []) {
    lines.push(
      [
        c.customer_name ?? "",
        c.customer_handle,
        c.platform,
        c.intent ?? "",
        c.sentiment ?? "",
        c.language ?? "",
        c.lead_score ?? "",
        c.status,
        c.last_message_at,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const csv = "﻿" + lines.join("\n"); // BOM so Excel reads Arabic correctly
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="growth-inspector-conversations-${today}.csv"`,
    },
  });
}
