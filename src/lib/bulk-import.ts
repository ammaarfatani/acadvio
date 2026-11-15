import { UNIVERSAL_ENTITIES, EntityDefinition, ImportColumnDef } from "./universal-import-config";

export type ImportEntity = string;
export type ImportRowStatus = "VALID" | "INVALID" | "DUPLICATE" | "IMPORTED" | "FAILED";

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  example: string;
  instruction?: string;
  type?: "string" | "number" | "date" | "boolean" | "enum" | "email";
  dropdownOptions?: string[];
}

export const IMPORT_COLUMNS: Record<string, ImportColumn[]> = Object.fromEntries(
  Object.entries(UNIVERSAL_ENTITIES).map(([k, def]) => [k, def.columns])
);

// Backward-compatibility aliases if any legacy code queries "students" or "teachers"
IMPORT_COLUMNS.students = UNIVERSAL_ENTITIES.students.columns;
IMPORT_COLUMNS.teachers = UNIVERSAL_ENTITIES.teachers.columns;

export interface ImportRow {
  rowNumber: number;
  sheet?: string;
  key?: string;
  values?: Record<string, string>;
  data?: Record<string, any>;
  status: ImportRowStatus;
  issues?: string[];
  message?: string;
}

export type StagedRow = ImportRow;

export interface SheetStat {
  sheet: string;
  total: number;
  valid: number;
  duplicate: number;
  invalid: number;
  imported?: number;
  failed?: number;
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  imported: number;
  failed: number;
  ready: number;
  sheets?: Record<string, { total: number; valid: number; invalid: number; duplicate: number; imported: number; failed: number }>;
  planTier?: string;
  planName?: string;
  demoNotice?: string;
}

export interface ImportPreview {
  id: string;
  entity: ImportEntity;
  filename: string;
  isMaster?: boolean;
  status: "PREVIEW" | "PROCESSING" | "COMPLETED" | "FAILED";
  summary: ImportSummary;
  rows: ImportRow[];
  sheets?: SheetStat[];
  planTier?: string;
  planName?: string;
  demoNotice?: string;
  totalRows?: number;
  validRows?: number;
  duplicateRows?: number;
  invalidRows?: number;
  processedRows?: number;
  successRows?: number;
  errorRows?: number;
  progress?: number;
  page: number;
  pages: number;
  processed: number;
  message?: string;
  expiresAt: string;
}

export { UNIVERSAL_ENTITIES };
export type { EntityDefinition, ImportColumnDef };
