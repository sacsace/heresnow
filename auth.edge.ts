import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/** Middleware only — no Credentials/Prisma (Node) providers. */
export const { auth } = NextAuth(authConfig);
