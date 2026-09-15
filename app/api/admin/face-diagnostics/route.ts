export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { diagnoseCompanyFaceTemplates } from "@/lib/faceTemplateDiagnostics";
import { NextResponse } from "next/server";

const ADMIN_ROLES = new Set(["HR", "ADMIN", "SUPER_ADMIN"]);

export async function GET(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  let companyId = session.user?.companyId ?? null;
  if (role === "SUPER_ADMIN") {
    companyId = url.searchParams.get("companyId") ?? companyId;
  }
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const summary = await diagnoseCompanyFaceTemplates(companyId);

  return NextResponse.json({
    ok: true,
    ...summary,
  });
}
