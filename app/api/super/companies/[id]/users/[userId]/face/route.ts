export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { syncEmployeeFaceFields } from "@/lib/faceCredentials";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const deleteSchema = z.union([
  z.object({ batchId: z.string().min(1) }),
  z.object({ id: z.string().min(1) }),
  z.object({ all: z.literal(true) }),
]);

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: companyId, userId } = await ctx.params;

  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true, employee: { select: { id: true } } },
  });
  if (!user?.employee) {
    return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
  }

  let json: unknown = { all: true };
  try {
    const text = await req.text();
    if (text.trim()) json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const employeeId = user.employee.id;

  if ("all" in parsed.data) {
    await prisma.employeeFaceCredential.deleteMany({ where: { employeeId } });
  } else if ("batchId" in parsed.data) {
    const deleted = await prisma.employeeFaceCredential.deleteMany({
      where: { employeeId, enrollmentBatchId: parsed.data.batchId },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Face enrollment not found" }, { status: 404 });
    }
  } else {
    const cred = await prisma.employeeFaceCredential.findFirst({
      where: { id: parsed.data.id, employeeId },
      select: { id: true },
    });
    if (!cred) {
      return NextResponse.json({ error: "Face enrollment not found" }, { status: 404 });
    }
    await prisma.employeeFaceCredential.delete({ where: { id: cred.id } });
  }

  await syncEmployeeFaceFields(employeeId);

  await prisma.approvalLog.create({
    data: {
      companyId,
      approverId: session.user.id,
      action: "USER_FACE_DELETE",
      targetType: "User",
      targetId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
