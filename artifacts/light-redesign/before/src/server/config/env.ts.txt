import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/acadivo_school_crm"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  NEXT_PUBLIC_API_URL: z.string().default("http://localhost:5000/api"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  SMTP_HOST: z.string().default("smtp.mailtrap.io"),
  SMTP_PORT: z.string().default("2525"),
  SMTP_USER: z.string().default("placeholder_user"),
  SMTP_PASS: z.string().default("placeholder_pass"),
  FROM_EMAIL: z.string().default("noreply@acadivo.com"),
}).refine(v=>v.JWT_ACCESS_SECRET!==v.JWT_REFRESH_SECRET,{message:"Access and refresh secrets must be different.",path:["JWT_REFRESH_SECRET"]});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) throw new Error("Invalid server configuration: " + parsed.error.issues.map(i => i.path.join(".")).join(", "));
export const env = parsed.data;
