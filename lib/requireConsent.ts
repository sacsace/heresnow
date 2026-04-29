import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/** 동의 없으면 /consent 로 이동 (로그인 후 공통) */
export async function requireConsent() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { consentGivenAt: true },
  });

  if (!user?.consentGivenAt) redirect("/consent");
}
