import {
  companyNameMatchesQuery,
  pickUniqueCompanyByNameQuery,
} from "@/lib/companyNameMatch";
import { prisma } from "@/lib/prisma";

export type FaceLoginCompanyResolve =
  | { ok: true; companyId: string }
  | { ok: false; reason: "missing_name" | "not_found" | "ambiguous" };

/**
 * 안면 로그인 1:N 범위 — 회사명(부분·Private Limited 생략 가능)으로 테넌트 특정.
 */
export async function resolveFaceLoginCompanyId(
  companyName?: string | null
): Promise<FaceLoginCompanyResolve> {
  const trimmed = companyName?.trim() ?? "";
  if (!trimmed) return { ok: false, reason: "missing_name" };

  const candidates = await prisma.company.findMany({
    where: { faceRecognitionEnabled: true },
    select: { id: true, name: true },
  });

  const matched = pickUniqueCompanyByNameQuery(candidates, trimmed);
  if (matched) return { ok: true, companyId: matched.id };

  const matches = candidates.filter((c) => companyNameMatchesQuery(c.name, trimmed));
  if (matches.length > 1) return { ok: false, reason: "ambiguous" };

  return { ok: false, reason: "not_found" };
}
