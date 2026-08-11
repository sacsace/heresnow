import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig = {
  providers: [],
  /** 프로덕션에서는 리버스 프록시 뒤일 때만 AUTH_TRUST_HOST=true 로 명시적으로 허용 */
  trustHost: process.env.NODE_ENV === "development" || process.env.AUTH_TRUST_HOST === "true",
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  logger: {
    error(error) {
      const authErr = error as { type?: string; name?: string };
      const type = authErr.type ?? authErr.name ?? "";
      // Wrong email/password — expected; UI already shows login.errorCredentials.
      if (type === "CredentialsSignin" && process.env.NODE_ENV === "development") {
        return;
      }
      // Stale or invalid session cookie (AUTH_SECRET changed, expired token, etc.).
      // Auth.js clears the cookie; user should sign in again.
      if (type === "JWTSessionError") {
        return;
      }
      if (process.env.NODE_ENV === "development") {
        console.error("[auth]", error);
        return;
      }
      // 운영 로그에는 에러 객체 원문 대신 최소 분류값만 남겨 민감정보 노출을 줄인다.
      console.error("[auth]", type || "UnknownAuthError");
    },
    warn(code) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[auth]", code);
      }
    },
    debug(message, metadata) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[auth]", message, metadata ?? "");
      }
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      const provider = account?.provider;
      if (provider !== "credentials" && provider !== "face-login" && provider !== "passkey-login") return true;
      const u = user as {
        role?: Role;
        companyId?: string | null;
        employeeId?: string | null;
      };
      const { isUserSeatLoginAllowed } = await import("@/lib/seatAccess");
      const allowed = await isUserSeatLoginAllowed({
        role: u.role ?? "EMPLOYEE",
        companyId: u.companyId ?? null,
        employeeId: u.employeeId ?? null,
      });
      if (!allowed) return "/login?error=SeatLimit";
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.companyId = (user as { companyId: string | null }).companyId;
        token.employeeId = (user as { employeeId: string | null }).employeeId;
        token.sessionNonce = (user as { sessionNonce?: string | null }).sessionNonce ?? null;
      }

      const runtime = (globalThis as { EdgeRuntime?: string }).EdgeRuntime;
      const isEdgeRuntime = typeof runtime === "string" && runtime.length > 0;
      if (!isEdgeRuntime && token.sub && typeof token.sessionNonce === "string") {
        try {
          const { prisma } = await import("@/lib/prisma");
          const current = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              email: true,
              role: true,
              companyId: true,
              sessionNonce: true,
              employee: { select: { id: true } },
            },
          });
          if (!current?.sessionNonce || current.sessionNonce !== token.sessionNonce) {
            return {};
          }
          // 세션 중 역할이 바뀌어도 즉시 반영한다.
          // 정책: SUPER_ADMIN은 오직 root 식별자만 허용.
          token.role =
            current.role === "SUPER_ADMIN" && (current.email ?? "").trim().toLowerCase() !== "root"
              ? "COMPANY_ADMIN"
              : current.role;
          token.companyId = current.companyId ?? null;
          token.employeeId = current.employee?.id ?? null;
        } catch {
          // 인증 검증 실패 시 기존 토큰 유지(가용성 우선)
          return token;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role as Role;
        session.user.companyId = (token.companyId as string | null) ?? null;
        session.user.employeeId = (token.employeeId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
