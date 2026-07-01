import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** MVS(또는 연동 배치)가 HeresNow API를 호출할 때 사용하는 공유 키 */
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

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** 회사별 MVS API key (DB 저장용 해시) */
export function hashMvsApiKey(raw: string): string {
  return sha256Hex(raw);
}

export function verifyMvsApiKeyHash(
  headerValue: string | null,
  expectedHash: string | null | undefined
): boolean {
  if (!expectedHash) return false;
  const provided = headerValue?.trim();
  if (!provided) return false;
  try {
    const a = Buffer.from(sha256Hex(provided), "utf8");
    const b = Buffer.from(expectedHash, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** 48자 hex 키 생성 (예: MVS_INTEGRATION_API_KEY 값) */
export function generateMvsApiKey(): string {
  return randomBytes(24).toString("hex");
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
