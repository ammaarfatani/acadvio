import { z } from "zod";
import { SubscriptionStatus, SubscriptionPlan } from "../constants/subscription.constant";

export const ApproveSchoolSchema = z.object({
  schoolId: z.string().min(1, "School ID is required"),
});

export const RejectSchoolSchema = z.object({
  schoolId: z.string().min(1, "School ID is required"),
  reason: z.string().optional(),
});

export const UpdateSchoolSubscriptionSchema = z.object({
  schoolId: z.string().min(1, "School ID is required"),
  status: z.nativeEnum(SubscriptionStatus),
  plan: z.nativeEnum(SubscriptionPlan).optional(),
});

export const ExtendTrialSchema = z.object({
  schoolId: z.string().min(1, "School ID is required"),
  days: z.coerce.number().int().min(1, "Trial extension must be at least 1 day").max(365, "Trial extension cannot exceed 365 days"),
});

export const ResetAdminPasswordSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export type ApproveSchoolInput = z.infer<typeof ApproveSchoolSchema>;
export type RejectSchoolInput = z.infer<typeof RejectSchoolSchema>;
export type UpdateSchoolSubscriptionInput = z.infer<typeof UpdateSchoolSubscriptionSchema>;
