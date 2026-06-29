import { auth } from "@/auth";

/**
 * Server-side session read. Returns null if unauthenticated or if the JWT cookie
 * is invalid (JWTSessionError — e.g. after AUTH_SECRET change or stale cookie).
 */
export async function getServerSession() {
  try {
    return await auth();
  } catch {
    return null;
  }
}
