import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

/** APPROVER / HR_MANAGER / COMPANY_ADMIN — 예외 승인·반려 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (
    role !== "COMPANY_ADMIN" &&
    role !== "HR_MANAGER" &&
    role !== "APPROVER" &&
    role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ex = await prisma.attendanceException.findUnique({
    where: { id },
    include: { attendance: true },
  });
  if (!ex) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role !== "SUPER_ADMIN") {
    if (!session.user.companyId || ex.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Tenant mismatch" }, { status: 403 });
    }
  }

  if (ex.status !== "PENDING") {
    return NextResponse.json({ error: "Already resolved" }, { status: 400 });
  }

  const approved = parsed.data.action === "approve";

  await prisma.$transaction(async (tx) => {
    await tx.attendanceException.update({
      where: { id: ex.id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        resolvedAt: new Date(),
      },
    });
    await tx.attendanceRecord.update({
      where: { id: ex.attendanceId },
      data: { status: approved ? "APPROVED" : "REJECTED" },
    });
    await tx.approvalLog.create({
      data: {
        companyId: ex.companyId,
        approverId: session.user.id,
        action: approved ? "EXCEPTION_APPROVE" : "EXCEPTION_REJECT",
        targetType: "AttendanceException",
        targetId: ex.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
