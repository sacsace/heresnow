import { prisma } from "@/lib/prisma";

export type FaceLoginCompanyResolve =
  | { ok: true; companyId: string }
  | { ok: false; reason: "missing_name" | "not_found" };

/**
 * 안면 로그인 1:N 범위 — 단일 회사면 자동, 복수 테넌트면 회사명 필수.
 */
export async function resolveFaceLoginCompanyId(
  companyName?: string | null
): Promise<FaceLoginCompanyResolve> {
  const trimmed = companyName?.trim() ?? "";

  if (trimmed) {
    const company = await prisma.company.findFirst({
      where: {
        name: { equals: trimmed, mode: "insensitive" },
        faceRecognitionEnabled: true,
      },
      select: { id: true },
    });
    if (!company) return { ok: false, reason: "not_found" };
    return { ok: true, companyId: company.id };
  }

  const eligible = await prisma.company.findMany({
    where: { faceRecognitionEnabled: true },
    select: { id: true },
  });

  if (eligible.length === 1) {
    return { ok: true, companyId: eligible[0]!.id };
  }

  return { ok: false, reason: "missing_name" };
}

/** UI: 회사명 입력란 표시 여부 */
export async function faceLoginRequiresCompanyName(): Promise<boolean> {
  const count = await prisma.company.count({ where: { faceRecognitionEnabled: true } });
  return count > 1;
}
