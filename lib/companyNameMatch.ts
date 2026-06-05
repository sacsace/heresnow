/** 검색·매칭용 회사명 정규화 — 법인 접미사 제거, 공백·대소문자 통일 */
export function normalizeCompanyNameForSearch(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(
      /\b(private\s+limited|pvt\.?\s*ltd\.?|limited|ltd\.?|llp|inc\.?|corp\.?|corporation|co\.?\s*ltd\.?)\s*\.?\s*$/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();
}

export type CompanyNameCandidate = { id: string; name: string };

/**
 * 입력(query)이 회사명과 일치하는지 — 전체·접두·정규화 비교.
 * 예: "Minsub Ventures" → "Minsub Ventures Private Limited"
 */
export function companyNameMatchesQuery(companyName: string, query: string): boolean {
  const q = normalizeCompanyNameForSearch(query);
  if (!q) return false;

  const rawCompany = companyName.trim();
  const rawQuery = query.trim();
  if (rawCompany.toLowerCase() === rawQuery.toLowerCase()) return true;
  if (rawCompany.toLowerCase().startsWith(rawQuery.toLowerCase())) return true;

  const cn = normalizeCompanyNameForSearch(companyName);
  if (cn === q) return true;
  if (cn.startsWith(`${q} `)) return true;
  if (cn.startsWith(q)) {
    const rest = cn.slice(q.length);
    return rest === "" || rest.startsWith(" ");
  }
  return false;
}

/** 후보 중 query와 매칭되는 회사 1개 — 없거나 복수면 null */
export function pickUniqueCompanyByNameQuery<T extends CompanyNameCandidate>(
  candidates: T[],
  query: string
): T | null {
  const matches = candidates.filter((c) => companyNameMatchesQuery(c.name, query));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;

  const qNorm = normalizeCompanyNameForSearch(query);
  const exactNorm = matches.filter(
    (c) => normalizeCompanyNameForSearch(c.name) === qNorm
  );
  if (exactNorm.length === 1) return exactNorm[0]!;

  const rawLower = query.trim().toLowerCase();
  const exactRaw = matches.filter((c) => c.name.trim().toLowerCase() === rawLower);
  if (exactRaw.length === 1) return exactRaw[0]!;

  return null;
}
