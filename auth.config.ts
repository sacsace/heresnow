import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig = {
  providers: [],
  trustHost: true,
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
