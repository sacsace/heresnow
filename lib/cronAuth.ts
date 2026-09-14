import { timingSafeEqual } from "crypto";

/** Railway Cron 등 배치가 /api/cron/* 호출 시 Bearer 검증 */
export function verifyCronSecret(headerValue: string | null): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const provided = headerValue?.trim();
  if (!provided) return false;
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
