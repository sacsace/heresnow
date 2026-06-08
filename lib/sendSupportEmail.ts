import { getSmtpFromAddress, getSupportToEmail, isSupportEmailConfigured } from "@/lib/supportContact";
import nodemailer from "nodemailer";

export type SupportEmailInput = {
  name: string;
  email: string;
  message: string;
  meta?: {
    userId?: string | null;
    userEmail?: string | null;
    pageUrl?: string | null;
    ip?: string | null;
  };
};

function buildSupportEmailContent(input: SupportEmailInput): { subject: string; text: string } {
  const subject = `[HeresNow] Support — ${input.name}`;
  const lines = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.meta?.userId ? `User ID: ${input.meta.userId}` : null,
    input.meta?.userEmail ? `Signed-in as: ${input.meta.userEmail}` : null,
    input.meta?.pageUrl ? `Page: ${input.meta.pageUrl}` : null,
    input.meta?.ip ? `IP: ${input.meta.ip}` : null,
    "",
    "Message:",
    input.message,
  ].filter((line): line is string => line != null);

  return { subject, text: lines.join("\n") };
}

function smtpPort(): number {
  const raw = process.env.SUPPORT_SMTP_PORT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 587;
  return Number.isFinite(parsed) ? parsed : 587;
}

async function sendViaSmtp(input: SupportEmailInput): Promise<void> {
  const host = process.env.SUPPORT_SMTP_HOST!.trim();
  const user = process.env.SUPPORT_SMTP_USER!.trim();
  const pass = process.env.SUPPORT_SMTP_PASS!.trim();
  const port = smtpPort();
  const secure =
    process.env.SUPPORT_SMTP_SECURE?.trim().toLowerCase() === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const { subject, text } = buildSupportEmailContent(input);

  await transporter.sendMail({
    from: getSmtpFromAddress(),
    to: getSupportToEmail(),
    replyTo: input.email,
    subject,
    text,
  });
}

export async function sendSupportEmail(input: SupportEmailInput): Promise<void> {
  if (!isSupportEmailConfigured()) {
    throw new Error("MAIL_NOT_CONFIGURED");
  }

  await sendViaSmtp(input);
}
