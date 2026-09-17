export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageWorkRequests } from "@/lib/workRequestAccess";
import { parseWorkRequestTypeParam } from "@/lib/workRequestTypes";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageWorkRequests(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  let companyId = session.user.companyId;
  if (session.user.role === "SUPER_ADMIN") {
    const q = url.searchParams.get("companyId");
    if (!q) return NextResponse.json({ error: "companyId required" }, { status: 400 });
    companyId = q;
  }
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const type = parseWorkRequestTypeParam(url.searchParams.get("type"));

  const items = await prisma.workRequest.findMany({
    where: {
      companyId,
      status: "PENDING",
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { name: true } },
    },
  });

  return NextResponse.json({ requests: items });
}
