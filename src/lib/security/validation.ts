import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

export const registrationSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: z.string().min(12).max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const otpSchema = z.object({
  challengeId: z.string().cuid(),
  code: z.string().regex(/^\d{6}$/),
});
