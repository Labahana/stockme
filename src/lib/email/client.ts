import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export function requireResendInProduction() {
  if (process.env.NODE_ENV === "production" && !process.env.RESEND_API_KEY) {
    return { ok: false as const, reason: "email_not_configured" };
  }
  return { ok: true as const };
}

export function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL ?? "Stockme <orders@stockme.gentletap.co>";
}
