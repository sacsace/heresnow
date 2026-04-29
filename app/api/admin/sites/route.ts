import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  allowedRadius: z.number().positive().max(5000),
  expectedCheckIn: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
  expectedCheckOut: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "COMPANY_ADMIN" && session.user.role !== "HR_MANAGER") {
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

  const site = await prisma.site.create({
    data: {
      companyId: session.user.companyId,
      name: parsed.data.name.trim(),
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      allowedRadius: parsed.data.allowedRadius,
      expectedCheckIn: parsed.data.expectedCheckIn ?? null,
      expectedCheckOut: parsed.data.expectedCheckOut ?? null,
    },
  });

  return NextResponse.json({ site });
}
