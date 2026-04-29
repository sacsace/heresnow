import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { users: true, employees: true, attendanceRecords: true },
      },
    },
  });

  return NextResponse.json({ companies });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const c = await prisma.company.create({ data: { name: parsed.data.name.trim() } });
  return NextResponse.json({ company: c });
}
