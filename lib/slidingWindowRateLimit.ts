type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** 프로세스 메모리 기준 슬라이딩 윈도우 (단일 인스턴스·소규모 배포용) */
export function consumeRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: Math.max(0, bucket.resetAt - now) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** 테스트·장기 실행 시 오래된 버킷 정리 */
export function pruneRateLimitBuckets(olderThanMs = 3600_000): void {
  const cutoff = Date.now() - olderThanMs;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < cutoff) buckets.delete(key);
  }
}
