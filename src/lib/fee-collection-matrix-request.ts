import { z } from "zod";

const mongoId = (label: string) => z.string().refine(
  value => /^[a-f\d]{24}$/i.test(value),
  `${label} must be a valid 24-character MongoDB ObjectId.`,
);
const optionalFilterId = (label: string) => z.preprocess(
  value => value === "" ? undefined : value,
  mongoId(label).optional(),
);

export const feeCollectionMatrixRequestSchema = z.object({
  academicSessionId: mongoId("Academic Session"),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Receipt Date From must use YYYY-MM-DD format."),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Receipt Date Through must use YYYY-MM-DD format."),
  branchId: optionalFilterId("Branch"),
  classCategoryId: optionalFilterId("Class Category"),
  classId: optionalFilterId("Class"),
  sectionId: optionalFilterId("Section"),
  format: z.enum(["preview", "pdf", "xlsx"]).default("preview"),
}).strict();

export const feeCollectionMatrixFiltersSchema = z.object({
  classCategoryId: optionalFilterId("Class Category"),
  classId: optionalFilterId("Class"),
}).strict();

export type FeeCollectionMatrixRequest = z.infer<typeof feeCollectionMatrixRequestSchema>;

export function buildFeeCollectionMatrixRequest(input: {
  academicSessionId: string;
  fromDate: string;
  toDate: string;
  branchId?: string;
  classCategoryId?: string;
  classId?: string;
  sectionId?: string;
  format?: "preview" | "pdf" | "xlsx";
}) {
  return {
    academicSessionId: input.academicSessionId,
    fromDate: input.fromDate,
    toDate: input.toDate,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.classCategoryId ? { classCategoryId: input.classCategoryId } : {}),
    ...(input.classId ? { classId: input.classId } : {}),
    ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    ...(input.format ? { format: input.format } : {}),
  };
}
