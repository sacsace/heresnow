export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rootForbiddenResponse } from "@/lib/requireRootUser";
import { NextResponse } from "next/server";
import { z } from "zod";

const DeleteBody = z
  .object({
    employeeId: z.string().min(1),
    checkInId: z.string().min(1).optional(),
    checkOutId: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.checkInId || v.checkOutId), {
    message: "checkInId or checkOutId required",
  });

/** root — 직원별 하루 출·퇴근 쌍 삭제 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const denied = rootForbiddenResponse(session);
  if (denied) return denied;

  const { id: companyId } = await ctx.params;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = DeleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { employeeId, checkInId, checkOutId } = parsed.data;
  const recordIds = [checkInId, checkOutId].filter(Boolean) as string[];

  const records = await prisma.attendanceRecord.findMany({
    where: {
      id: { in: recordIds },
      companyId,
      employeeId,
    },
    select: { id: true, type: true },
  });

  if (records.length !== recordIds.length) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  for (const id of recordIds) {
    const row = records.find((r) => r.id === id);
    if (!row) continue;
    if (id === checkInId && row.type !== "CHECK_IN") {
      return NextResponse.json({ error: "Invalid checkInId" }, { status: 400 });
    }
    if (id === checkOutId && row.type !== "CHECK_OUT") {
      return NextResponse.json({ error: "Invalid checkOutId" }, { status: 400 });
    }
  }

  const deleted = await prisma.attendanceRecord.deleteMany({
    where: { id: { in: recordIds }, companyId, employeeId },
  });

  return NextResponse.json({ ok: true, deleted: deleted.count });
}
