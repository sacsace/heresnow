import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: companyId, userId } = await ctx.params;

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

  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true, employee: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!user.employee) {
    return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
  }

  const name = parsed.data.name.trim();
  const employee = await prisma.employee.update({
    where: { id: user.employee.id },
    data: { name },
    select: { id: true, name: true },
  });

  return NextResponse.json({ employee });
}
