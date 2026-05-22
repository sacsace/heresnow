import { timingSafeEqual } from "crypto";

/** MVS(또는 연동 배치)가 HereNow API를 호출할 때 사용하는 공유 키 */
export function verifyMvsIntegrationApiKey(headerValue: string | null): boolean {
  const expected = process.env.MVS_INTEGRATION_API_KEY?.trim();
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

export function verifyIntegrationDispatchSecret(headerValue: string | null): boolean {
  const expected = process.env.INTEGRATION_DISPATCH_SECRET?.trim();
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
