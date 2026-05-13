import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const where =
    status === "PENDING" || status === "APPROVED" || status === "REJECTED" ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {};

  const requests = await prisma.billingRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { id: true, name: true, seatLimit: true } },
      targetTier: true,
    },
  });

  return NextResponse.json({ requests });
}
