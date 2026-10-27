import { storeDevelopmentOtp } from "@/lib/security/dev-otp";

export class EmailDeliveryError extends Error {}

export function isOtpDeliveryConfigured(): boolean {
  if (process.env.EMAIL_PROVIDER === "console") {
    return process.env.NODE_ENV === "development";
  }
  return Boolean(
    process.env.EMAIL_PROVIDER === "resend" &&
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM,
  );
}

export async function sendLoginOtp(
  email: string,
  code: string,
  developmentContext?: { challengeId: string; expiresAt: Date },
): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER;
  if (provider === "console") {
    if (process.env.NODE_ENV !== "development") {
      throw new EmailDeliveryError("Console email delivery is only allowed in development.");
    }
    if (!developmentContext) {
      throw new EmailDeliveryError("The local development OTP inbox is unavailable.");
    }
    try {
      storeDevelopmentOtp(
        developmentContext.challengeId,
        code,
        developmentContext.expiresAt,
      );
    } catch {
      throw new EmailDeliveryError("The local development OTP inbox is unavailable.");
    }
    return;
  }

  if (provider !== "resend" || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new EmailDeliveryError(
      "Email delivery is not configured. Set EMAIL_PROVIDER=resend, RESEND_API_KEY, and EMAIL_FROM.",
    );
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email],
        subject: "Your SentinelID verification code",
        text: `Your SentinelID verification code is ${code}. It expires shortly. If you did not try to sign in, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new EmailDeliveryError(`Email provider returned status ${response.status}.`);
    }
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    throw new EmailDeliveryError("The email provider could not be reached.");
  }
}
