import { Branch } from "../models/branch.model";
import type { AuthenticatedUser } from "../middlewares/auth.middleware";
import { defaultMarksheetPrintSettings, marksheetPrintSettingsSchema } from "../../lib/marksheet-print-settings";

export async function readMarksheetPrintSettings(user: AuthenticatedUser) {
  if (!user.branchId) return defaultMarksheetPrintSettings;
  const branch: any = await Branch.findOne({ _id: user.branchId, organizationId: user.schoolId }).select("marksheetPrintSettings").lean();
  if (!branch) throw { statusCode: 404, message: "Branch not found." };
  const saved = marksheetPrintSettingsSchema.safeParse(branch.marksheetPrintSettings);
  return saved.success ? saved.data : defaultMarksheetPrintSettings;
}
