import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig = {
  providers: [],
  /** 프로덕션에서는 리버스 프록시 뒤일 때만 AUTH_TRUST_HOST=true 로 명시적으로 허용 */
  trustHost: process.env.NODE_ENV === "development" || process.env.AUTH_TRUST_HOST === "true",
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
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
