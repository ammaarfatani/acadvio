import { z } from "zod";


export const RegisterSchoolSchema = z.object({
  schoolName: z.string().trim().min(3, "School name must be at least 3 characters"),
  schoolEmail: z.string().trim().email("Enter a valid school email address"),
  schoolPhone: z.string().trim().min(7, "Enter a valid school phone number").max(25, "Phone number is too long"),
  schoolAddress: z.string().trim().min(5, "Enter the school address"),
  adminName: z.string().trim().min(3, "Admin name must be at least 3 characters"),
  adminEmail: z.string().trim().email("Enter a valid admin email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  studentCountRange: z.enum(["1-200", "201-500", "501-1000", "1000+"]).default("201-500"),
  teacherCount: z.coerce.number().int().min(0, "Teacher count cannot be negative").max(10000, "Teacher count is too high"),
  registrationType: z.enum(["trial", "paid"]).default("trial"),
  selectedPlan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]).optional(),
}).refine(data => data.registrationType !== "paid" || !!data.selectedPlan, { message: "Select a paid subscription plan.", path: ["selectedPlan"] }).transform(data => ({ ...data, selectedPlan: data.registrationType === "trial" ? undefined : data.selectedPlan }));

export type RegisterSchoolInput = z.infer<typeof RegisterSchoolSchema>;


