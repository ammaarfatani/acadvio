import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().max(254).email("Invalid email address"),
  password: z.string().min(1, "Password is required").max(1024),
  schoolCode: z.string().max(120).optional(),
  schoolSlug: z
    .string()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, "Refresh token is required")
    .max(4096)
    .optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().max(254).email("Invalid email address"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required").max(4096),
  newPassword: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(72)
    .refine(
      (v) => Buffer.byteLength(v, "utf8") <= 72,
      "Password must be at most 72 bytes.",
    ),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
