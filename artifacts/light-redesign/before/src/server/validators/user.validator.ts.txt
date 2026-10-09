import { z } from "zod";
import { UserType } from "../constants/roles.constant";

export const CreateUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  employeeId:z.string().trim().min(1).max(60).optional(),phone:z.string().trim().max(30).optional(),department:z.string().trim().min(2).max(100).optional(),joiningDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),salary:z.number().finite().min(0).max(1e9).optional(),
  userType: z.enum([
    UserType.PARENT,
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
