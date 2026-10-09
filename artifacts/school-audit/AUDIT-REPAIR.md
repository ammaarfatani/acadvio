# Acadivo school administration repair and verification

Existing application architecture and real school records were preserved. Updates cover teachers and class assignments, staff/department forms, parent admission/linking, attendance and payroll management, weekly timetables, school-wide term examinations, combined mark sheets, notices and secure parent documents.

## Completed data

The additive APTECH-DEMO-2026 dataset contains 50 students, 50 primary parents, 10 teachers, Classes 1–10, 20 sections, 80 subjects, 960 lessons, 320 exam papers, 42 fee invoices, 26 recorded collections and 10 payroll rows. Records deliberately include pending, absent, unpaid and partially paid examples. No real funds were transferred or external emails sent. Existing records were retained.

Demo passwords are available only in the ignored `demo-credentials.private.json`; they are not included in this report.

## Completed automated verification

- 553 real HTTP checks: all 50 parent logins, child isolation, all 10 demo teacher logins, timetable, exams, results, attendance and payroll.
- 47 admission, parent reuse, class assignment, timetable, pending/absent marks and weighted result lifecycle checks.
- 227 organization security and 120 workforce security checks.
- Bulk import verification using 1,001 disposable test students, including rollback and lease recovery.
- TypeScript checks passed. Final production build passed with exit code 0; all 132 static pages and build traces completed.
- Actual parent PDF was rendered and visually inspected. 27 notice audience, secure PDF download and existing account checks passed. Five supplied accounts authenticated; the supplied finance credentials did not authenticate. Detailed exceptions are recorded in `communication-verification.json`.

## Limitations requiring follow-up

The supplied examination email belongs to an existing FINANCE account. Its role was preserved rather than changed to bypass authorization. Supplied credentials that fail authentication are recorded separately by the communication verification script; no passwords were reset.

The teacher desktop capture was inspected previously. Remaining portal/mobile and browser print-preview verification is incomplete: Windows Computer Use stopped because it could not determine the active browser URL confidently. No further browser input was issued after the stop. Open the CRM URL in Chrome and continue in a fresh turn to resume those visual checks.

Lint reports existing and current hook-dependency/image optimization warnings. Compilation success is not a claim that all warnings are resolved.
