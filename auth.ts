import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const { authorizeCredentials } = await import("@/lib/authorizeCredentials");
        return authorizeCredentials(credentials);
      },
    }),
    Credentials({
      id: "face-login",
      name: "Face Login",
      credentials: {
        loginToken: { label: "Login Token", type: "text" },
      },
      authorize: async (credentials) => {
        const { authorizeFaceLogin } = await import("@/lib/authorizeFaceLogin");
        return authorizeFaceLogin(credentials);
      },
    }),
    Credentials({
      id: "passkey-login",
      name: "Passkey Login",
      credentials: {
        loginToken: { label: "Login Token", type: "text" },
      },
      authorize: async (credentials) => {
        const { authorizePasskeyLogin } = await import("@/lib/authorizePasskeyLogin");
        return authorizePasskeyLogin(credentials);
      },
    }),
  ],
});
