export type ImportEntity = "students" | "teachers";
export type ImportRowStatus = "VALID" | "INVALID" | "DUPLICATE" | "IMPORTED" | "FAILED";
export interface ImportColumn {
    key: string;
    label: string;
    required?: boolean;
    example: string;
    instruction?: string;
}
export const IMPORT_COLUMNS: Record<ImportEntity, ImportColumn[]> = {
    students: [
        {key:"bFormNumber",label:"B-Form Number",example:"00123-4567890-1",instruction:"Optional. Format the Excel cell as Text to preserve leading zeros."},
        { key: "studentId", label: "Student ID", example: "ST-1024", instruction: "Optional; generated if blank. Must be unique within your school." },
        { key: "admissionNumber", label: "Admission Number", example: "ADM-1024", instruction: "Optional; generated if blank. Must be unique within your school." },
        { key: "name", label: "Name", required: true, example: "Example Student", instruction: "Full student name, matching the existing student record." },
        { key: "dob", label: "Date of Birth", required: true, example: "2012-04-15", instruction: "YYYY-MM-DD or an Excel date cell." },
        { key: "gender", label: "Gender", required: true, example: "Male", instruction: "Male, Female or Other." },
        { key: "academicSession", label: "Academic Session", example: "Your current session", instruction: "Exact session name or ID. Blank uses your current session." },
        { key: "class", label: "Class", required: true, example: "Your class", instruction: "Existing class name, code or ID." },
        { key: "section", label: "Section", required: true, example: "Your section", instruction: "Existing section name or ID under the selected class." },
        { key: "rollNumber", label: "Roll Number", example: "10-A-24", instruction: "Optional; generated if blank. Unique within session/class/section." },
        { key: "admissionDate", label: "Admission Date", example: "2026-10-03", instruction: "YYYY-MM-DD. Blank uses upload date." },
        { key: "address", label: "Address", required: true, example: "Example address, Karachi" },
        { key: "phone", label: "Phone", example: "03001234567", instruction: "Keep telephone numbers as text to preserve leading zeroes." },
        { key: "fatherName", label: "Father Name", required: true, example: "Example Parent" },
        { key: "fatherPhone", label: "Father Phone", required: true, example: "03001234567" },
        { key: "fatherCnic", label: "Father CNIC", example: "", instruction: "Optional supported parent identification field. Store as text." },
        { key: "fatherOccupation", label: "Father Occupation", example: "" },
        { key: "motherName", label: "Mother Name", example: "" },
        { key: "motherPhone", label: "Mother Phone", example: "" },
        { key: "guardianName", label: "Guardian Name", example: "" },
        { key: "guardianPhone", label: "Guardian Phone", example: "" },
        { key: "guardianEmail", label: "Guardian Email", example: "parent@example.com", instruction: "Optional valid guardian email. Student email is not supported." },
        { key: "guardianRelation", label: "Guardian Relation", example: "" },
        { key: "emergencyName", label: "Emergency Contact Name", required: true, example: "Example Parent" },
        { key: "emergencyPhone", label: "Emergency Contact Phone", required: true, example: "03001234567" },
        { key: "emergencyRelation", label: "Emergency Contact Relation", required: true, example: "Father" },
    ],
    teachers: [
        { key: "employeeId", label: "Employee ID", example: "EMP-1024", instruction: "Optional. Must be unique within your school." },
        { key: "name", label: "Name", required: true, example: "Example Teacher" },
        { key: "email", label: "Email", required: true, example: "teacher@example.com", instruction: "A unique login email. Existing accounts are never overwritten." },
        { key: "password", label: "Initial Password", required: true, example: "", instruction: "At least 8 characters, as required by Add Teacher. Use a distinct secure password. Never included in preview or reports." },
        { key: "qualification", label: "Qualification", example: "" },
        { key: "phone", label: "Phone", example: "03001234567" },
        { key: "academicSession", label: "Academic Session", example: "", instruction: "Blank uses the current session for assignments." },
        { key: "class", label: "Classes", example: "", instruction: "Optional assignments. Separate multiple existing classes with semicolons; pair each with Sections and Subjects in the same order." },
        { key: "section", label: "Sections", example: "", instruction: "Section names or IDs, separated by semicolons." },
        { key: "subject", label: "Subjects", example: "", instruction: "Subject names, codes or IDs under the paired class, separated by semicolons." },
    ],
};
export interface ImportRow {
    rowNumber: number;
    values: Record<string, string>;
    status: ImportRowStatus;
    issues: string[];
}
export interface ImportSummary {
    total: number;
    valid: number;
    invalid: number;
    duplicate: number;
    imported: number;
    failed: number;
    ready: number;
}
export interface ImportPreview {
    id: string;
    entity: ImportEntity;
    filename: string;
    status: "PREVIEW" | "PROCESSING" | "COMPLETED" | "FAILED";
    summary: ImportSummary;
    rows: ImportRow[];
    page: number;
    pages: number;
    processed: number;
    message?: string;
    expiresAt: string;
}
