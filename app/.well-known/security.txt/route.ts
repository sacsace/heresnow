export const runtime = "nodejs";
export const dynamic = "force-static";

const SECURITY_CONTACT_EMAIL =
  process.env.SECURITY_CONTACT_EMAIL?.trim() || "security@heresnow.in";
const SECURITY_POLICY_URL =
  process.env.SECURITY_POLICY_URL?.trim() || "https://www.heresnow.in/terms";
const SECURITY_ACK_URL =
  process.env.SECURITY_ACKNOWLEDGEMENTS_URL?.trim() || "https://www.heresnow.in/support";

export async function GET() {
  const body = [
    `Contact: mailto:${SECURITY_CONTACT_EMAIL}`,
    `Policy: ${SECURITY_POLICY_URL}`,
    `Acknowledgments: ${SECURITY_ACK_URL}`,
    "Preferred-Languages: ko, en",
    `Expires: ${new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()}`,
  ].join("\n");

  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
