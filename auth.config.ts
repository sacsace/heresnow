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
      const text =
        error instanceof Error ? `${error.name} ${error.message}` : String(error);
      // Wrong email/password — expected; UI already shows login.errorCredentials.
      if (text.includes("CredentialsSignin")) {
        if (process.env.NODE_ENV === "development") return;
      }
      console.error("[auth]", error);
    },
    warn(code) {
      console.warn("[auth]", code);
    },
    debug(message, metadata) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[auth]", message, metadata ?? "");
      }
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "credentials") return true;
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
