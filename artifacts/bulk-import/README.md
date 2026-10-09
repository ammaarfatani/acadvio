# Acadivo School Admin bulk import

Open Students or Teachers and choose **Bulk Upload**. Existing manual Add Student/Add Teacher remains available.

1. Download your school template. Fill only Students/Teachers; keep headers unchanged. Examples are on a separate sheet and never imported.
2. Use the workbook reference sheets for this school's sessions, classes, sections and subjects. IDs, names and supported codes resolve on the server; references to other schools are rejected.
3. Upload XLSX, legacy XLS or CSV, review row errors and duplicates, then choose Review Import and confirm Import.
4. Invalid rows are skipped. Duplicate records are skipped without overwriting. Download Error Report for correction; re-upload corrected rows.

## Supported fields and safeguards

Column definitions live in `src/lib/bulk-import.ts`, matching existing Student, User, TeacherProfile and TeachingAssignment models. Student records use a full Name, DOB, gender, address, parent/emergency contacts and school academic references. Unsupported student email/blood group/previous school and unsupported teacher personal fields are not invented.

Teachers require the same login email/password validation as manual Add Teacher. Optional assignments use paired Classes, Sections and Subjects separated by semicolons, with one session or a paired session per assignment. Passwords are encrypted in short-lived server staging, hidden from all previews/reports, hashed through the existing password utility, and removed from staging after processing. Accounts use the existing teacher role and authentication system.

Limits: 5 MB upload, 5,000 records, 100 columns, 2,000 characters per cell, 40 MB XLSX expanded ZIP size, 12 MB staged record JSON. Split oversized files. Formula cells are rejected. Preserve leading zeroes by formatting phone/ID columns as text. Dates use YYYY-MM-DD or actual Excel date cells.

Only authenticated School Admins with students.create/teachers.create can access import APIs. School and actor are derived from the authenticated user, never uploaded fields. Previews and reports are scoped to both school and submitting admin. Staging expires after 24 hours.

Imports run in batches of 100 with real persisted progress, transaction rollback, deterministic row record IDs, repeat-confirmation protection, and one active import per school/entity. References, unique identifiers and plan capacity are rechecked before each batch. Database transactions require MongoDB Atlas or a replica set; standalone MongoDB stops safely with an explanatory report. Server workers resume staged jobs on startup and every minute using renewable exclusive leases. Reopen Bulk Upload after refreshing to restore progress within the same browser session. Progress polls every five seconds to respect existing API rate limits. Completion produces a school audit entry. Existing teacher assignment notifications are maintained for imported students and teachers.

The new unique student index is schoolId + studentId, in addition to existing admission and roll indexes. Existing deployments must resolve any pre-existing duplicate student IDs before this unique index can be created; never delete or overwrite records automatically.

## Verification

`node tests/bulk-import.cjs` uses the configured MongoDB connection with a separate randomly named database beginning acadivo_import_test_. It creates isolated fixtures and removes only that disposable database. It never imports test students/teachers into existing schools.

Verified: 1,001 student records, XLSX/XLS/CSV parsing, teacher accounts/profiles/assignments/password hashes, row errors, existing/file duplicates, replay prevention, post-preview duplicate races, cross-tenant denial, permission checks, error workbooks, transaction rollback, expiry, plan capacity, worker recovery and competing-job serialization, existing student/teacher directories and manual create APIs.

TypeScript and isolated production build passed. Existing subscription/payment and trial/branding regression suites passed. Import code passes Next core-web-vitals lint. Full-project lint reports 15 existing unescaped-text errors and 20 warnings in unrelated files, saved in lint-results.json. The repo's default next lint also asks for initial setup because its existing eslint.config.mjs targets a newer ESLint/Next configuration than the installed Next 14/ESLint 8 combination; verification used eslint-verification.json without changing global lint rules.

Live localhost:5000 authenticated template endpoints passed for students and teachers (five/six workbook sheets). Browser visual verification is blocked by CUA initialization error: failed to write kernel assets / system cannot find the path specified (os error 3), persisting after reset. No browser screenshots or visual verification are claimed.
