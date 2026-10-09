# Parent Portal audit and repair

Verified on 6 October 2026. Existing models, authentication, school data and previous workforce/payment work are preserved.

## Findings and repairs

| Finding | Repair |
| --- | --- |
| Child selector lived only on the old main page; documents and notifications showed family-wide records. | Shared ParentProvider preserves selected child across dashboard, children, academics, fees, documents, announcements and notifications. Server query filters validate the linked student before applying the selected audience. |
| Existing student had classId but no sectionId or academicSessionId; a section-specific timetable was incorrectly hidden. | Read-only placement resolution uses the existing class, its single matching section and current academic session. Multiple possible sections show a warning and hide section-specific records. No automatic database relinking. |
| Legacy timetable slots were excluded by exact session queries; current and legacy slots could duplicate periods. | Include sessionless legacy slots alongside the resolved session, prefer section-specific/current entries for the same day and period, and sort by weekday/period. Resolve subject/teacher names from tenant-matched references. |
| Updates from other portals remained stale unless a payment was pending. | Refresh child records and linked-child lists every 30 seconds while visible and on focus; provide manual refresh. Cancel stale responses logically with selection/generation guards. Resource pages also refresh their selected-child data. |
| Literal question marks replaced separators, apostrophes and loading indicators in multiple portals. | Correct identified strings and JSX text using UTF-8 writes. Preserve real questions, ternaries, regex patterns and URL queries. Add UTF-8 editor configuration and an AST-aware global text integrity check. |
| Records mixed with broad printouts and ambiguous empty labels. | Organize pages and document categories; isolated result/receipt/issued-certificate record print views support browser Save PDF. Loading, errors, dates and genuine empty states are explicit. |

## Existing sources of truth

- ParentProfile.studentIds and scoped Student records enforce ownership.
- FeeChallan and FeePayment remain the invoice and verified-payment ledger. FeeSubmission remains the existing secure proof/review workflow. Parent-submitted approved bank references are associated with their ledger payments; no duplicate finance engine.
- StudentAttendance supplies recorded statuses, monthly/all-date summaries and daily history. Only the selected student's record is projected from each class batch.
- Subject, TimetableSlot, ClassModel, SectionModel and AcademicSession supply academics and placement.
- ExamSchedule supplies class schedules and configured subjects/date ranges. The existing exam schema does not store per-subject start/end times; no fabricated times are displayed.
- Only published ProcessedResult records are exposed. CertificateRecord supplies issued certificate metadata; its printable record is explicitly not a signed original certificate.
- Published/unexpired SchoolDocument files remain protected binary downloads. Selected child is checked for both list and download. Available GENERAL, ADMISSION, PERMISSION, FEES and EXAMINATION categories use human-readable labels; finance/exam categories respect plan entitlements.
- Existing Announcement/NoticeRead and workspace notifications provide school updates and selected-child fee/payment reminders.
- No existing student homework/assignment submission model or API was found. TeachingAssignment is teacher allocation, not homework; no fake assignment section or duplicate module was added.

## Actual database verification

The supplied existing parent account has one linked child. Its legacy placement resolves to the existing class section and academic session without modifying stored records. Its actual timetable and class examination are now visible in the browser. Today's scheduled examination is included through the local calendar date, rather than excluded at midnight.

For that linked student, the actual database currently contains zero fee challans, zero verified fee payments, zero student attendance batches and zero published results. The school has one fee challan, but it does not reference this linked child; the school has zero FeePayment ledger records. Assigning another student's invoice or inventing a bank transaction would be incorrect. The portal displays accurate empty states until records are issued/posted to the correct student through the existing school/finance workflows.

Production school/student/finance records were not altered or populated with fixtures. The read-only audit script requires PARENT_AUDIT_EMAIL; no password is stored in it.

## Verification

- 227 actual HTTP/MongoDB integration assertions passed in the guarded, disposable organization test database. Fixtures were dropped by the suite's finally block. Covers original portals, real login, plans, tenants/branches, parent linking, multiple children, attendance/results/payment separation, selected-child notices/documents/notifications, private downloads, unauthorized/malformed IDs, legacy/ambiguous placement, current-session timetable preference, bank reference linkage and password/token revocation.
- TypeScript checks passed; quiet lint passed. Production Next build passed for all routes. Existing nonblocking image and unrelated hook warnings remain in the full build output.
- AST-aware UTF-8/text integrity scan passed across all source portals, preserving intentional question punctuation and code syntax.
- 30 existing attendance/calendar/payroll calculation regressions passed.
- Browser used the supplied actual parent account. Dashboard, child profile, academics, examination schedule, timetable, fees and documents were inspected. Mobile sidebar worked. Dashboard checked at 390, 768, 1024 and 1440 pixels; no horizontal document overflow. Checked console error logs were empty. Screenshots redact personal information.
- The live account has only one child; multi-child authorization/data separation was verified through isolated integration fixtures rather than adding production children or pretending the live account has siblings.

## Review artifacts

- dashboard-verified.png: desktop dashboard, personal details redacted.
- dashboard-mobile-verified.png: mobile dashboard, personal details redacted.
- tests/organization-security.cjs: expanded integration suite.
- tests/text-integrity.cjs: global UTF-8/rendered text audit.
- tests/parent-real-audit.cjs: read-only configured-database audit; requires PARENT_AUDIT_EMAIL.

No deployment or Git commit was performed.
