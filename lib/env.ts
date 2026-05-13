import { z } from "zod";

/**
 * 서버 전용 환경 변수 검증. Prisma 등 DB 접근 모듈에서만 로드되도록 유지합니다.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("postgresql://") || s.startsWith("postgres://"), {
      message: "DATABASE_URL은 postgres 연결 문자열이어야 합니다.",
    }),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET은 최소 32자 이상이어야 합니다."),
});

let cached: z.infer<typeof serverEnvSchema> | null = null;

export function assertServerEnv(): void {
  if (cached) return;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const err = parsed.error.flatten().fieldErrors;
    throw new Error(`환경 변수 오류: ${JSON.stringify(err)}`);
  }
  cached = parsed.data;
}
