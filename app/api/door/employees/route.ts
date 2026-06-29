export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { DOOR_PUNCHABLE_ROLES } from "@/lib/doorAttendance";
import { doorApiForbidden } from "@/lib/requireDoorRole";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const denied = doorApiForbidden(session);
  if (denied) return denied;

  const companyId = session!.user!.companyId!;
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      user: { role: { in: DOOR_PUNCHABLE_ROLES } },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      user: { select: { email: true } },
      department: { select: { name: true } },
    },
    take: 80,
  });

  return NextResponse.json({ employees });
}
