export const PASSKEY_REGISTER_CHALLENGE_COOKIE = "hn_passkey_reg_challenge";
export const PASSKEY_LOGIN_CHALLENGE_COOKIE = "hn_passkey_login_challenge";

export function cookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 5,
  };
}

