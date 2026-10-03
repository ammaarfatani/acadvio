import { z } from "zod";
import { UserType } from "../constants/roles.constant";

export const CreateUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  userType: z.enum([
    UserType.TEACHER,
    UserType.FINANCE,
    UserType.EXAM_STAFF,
    UserType.RECEPTIONIST,
    UserType.SCHOOL_ADMIN,
  ]),
});

export const UpdateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "DEACTIVATED"]),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;
