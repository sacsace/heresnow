import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";
import {
  applySessionExpiry,
  parseStaySignedIn,
  SESSION_MAX_AGE_MOBILE_SEC,
  SESSION_UPDATE_AGE_SEC,
  sessionMaxAgeSec,
} from "@/lib/sessionDuration";

export const authConfig = {
  providers: [],
  /** 프로덕션에서는 리버스 프록시 뒤일 때만 AUTH_TRUST_HOST=true 로 명시적으로 허용 */
  trustHost: process.env.NODE_ENV === "development" || process.env.AUTH_TRUST_HOST === "true",
  pages: { signIn: "/login" },
  session: {
    strategy: "jwt",
    /** 쿠키 상한 — 실제 만료는 JWT exp + sessionMaxAge(모바일/데스크톱) */
    maxAge: SESSION_MAX_AGE_MOBILE_SEC,
    updateAge: SESSION_UPDATE_AGE_SEC,
  },
  logger: {
    error(error) {
      const authErr = error as { type?: string; name?: string };
      const type = authErr.type ?? authErr.name ?? "";
      if (type === "CredentialsSignin" && process.env.NODE_ENV === "development") {
        return;
      }
      if (type === "JWTSessionError") {
        return;
      }
      if (process.env.NODE_ENV === "development") {
        console.error("[auth]", error);
        return;
      }
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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.companyId = (user as { companyId: string | null }).companyId;
        token.employeeId = (user as { employeeId: string | null }).employeeId;
        token.sessionNonce = (user as { sessionNonce?: string | null }).sessionNonce ?? null;
        applySessionExpiry(
          token,
          sessionMaxAgeSec(parseStaySignedIn((user as { staySignedIn?: unknown }).staySignedIn))
        );
        return token;
      }

      const runtime = (globalThis as { EdgeRuntime?: string }).EdgeRuntime;
      const isEdgeRuntime = typeof runtime === "string" && runtime.length > 0;

      if (!isEdgeRuntime && trigger === "update" && typeof token.sessionMaxAge === "number") {
        applySessionExpiry(token, token.sessionMaxAge);
        if (token.sub && typeof token.sessionNonce === "string") {
          const { extendUserSessionExpiry } = await import("@/lib/userSessions");
          void extendUserSessionExpiry(token.sub, token.sessionNonce, token.sessionMaxAge);
        }
      } else if (trigger === "update" && typeof token.sessionMaxAge === "number") {
        applySessionExpiry(token, token.sessionMaxAge);
      }

      if (!isEdgeRuntime && token.sub && typeof token.sessionNonce === "string") {
        try {
          const { validateUserSession } = await import("@/lib/userSessions");
          const sessionValid = await validateUserSession(token.sub, token.sessionNonce);
          if (!sessionValid) {
            return {};
          }

          const { prisma } = await import("@/lib/prisma");
          const current = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              email: true,
              role: true,
              companyId: true,
              employee: { select: { id: true } },
            },
          });
          if (!current) {
            return {};
          }
          token.role =
            current.role === "SUPER_ADMIN" && (current.email ?? "").trim().toLowerCase() !== "root"
              ? "COMPANY_ADMIN"
              : current.role;
          token.companyId = current.companyId ?? null;
          token.employeeId = current.employee?.id ?? null;
        } catch {
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
  events: {
    signOut(message) {
      const token = "token" in message ? message.token : null;
      if (token?.sub && typeof token.sessionNonce === "string") {
        void import("@/lib/userSessions").then(({ revokeUserSession }) =>
          revokeUserSession(token.sub!, token.sessionNonce!)
        );
      }
    },
  },
} satisfies NextAuthConfig;
